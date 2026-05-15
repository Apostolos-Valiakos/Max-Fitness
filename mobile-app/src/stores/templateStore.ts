import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '@/lib/rxdb/database'
import { supabase } from '@/lib/supabase'
import type { WorkoutTemplateDocument, TemplateExerciseDocument } from '@/lib/rxdb/schemas'
import { useAuthStore } from './authStore'

export const useTemplateStore = defineStore('templates', () => {
  const templates  = ref<WorkoutTemplateDocument[]>([])
  const isLoading  = ref(false)
  const FREE_LIMIT = 3

  function subscribeToTemplates(userId: string) {
    const db = getDatabase()
    db.workout_templates
      .find({
        selector: { $or: [{ owner_id: { $eq: userId } }, { is_public: { $eq: true } }] },
        sort: [{ updated_at: 'desc' }],
      })
      .$.subscribe(docs => { templates.value = docs.map(d => d.toJSON()).filter(d => !d._deleted) })
  }

  function canCreate(): boolean {
    const auth = useAuthStore()
    if (auth.isFree && templates.value.length >= FREE_LIMIT) return false
    return true
  }

  async function createTemplate(name: string, notes?: string): Promise<WorkoutTemplateDocument | null> {
    if (!canCreate()) return null
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const db = getDatabase(); const now = new Date().toISOString()
    const tmpl: WorkoutTemplateDocument = { id: uuidv4(), owner_id: user.id, assigned_by: null, name, notes: notes ?? null, is_public: false, visibility: 'private', updated_at: now, folder_name: null }
    await db.workout_templates.insert(tmpl)
    return tmpl
  }

  async function updateTemplate(id: string, updates: Partial<Pick<WorkoutTemplateDocument, 'name' | 'notes' | 'folder_name'>>) {
    const db = getDatabase()
    await db.workout_templates.findOne(id).update({ $set: { ...updates, updated_at: new Date().toISOString() } })
  }

  async function moveToFolder(templateId: string, folderName: string | null) {
    await updateTemplate(templateId, { folder_name: folderName })
  }

  async function deleteTemplate(id: string) {
    const db = getDatabase()
    // Remove exercises first
    const exercises = await db.template_exercises.find({ selector: { template_id: { $eq: id } } }).exec()
    for (const ex of exercises) await ex.remove()
    await db.workout_templates.findOne(id).remove()
  }

  // ── Template exercises ──────────────────────────────────────────────────────

  async function getTemplateExercises(templateId: string): Promise<TemplateExerciseDocument[]> {
    const db = getDatabase()
    const docs = await db.template_exercises
      .find({ selector: { template_id: { $eq: templateId } }, sort: [{ position: 'asc' }] })
      .exec()
    return docs.map(d => d.toJSON()).filter(d => !d._deleted)
  }

  async function addExerciseToTemplate(
    templateId: string,
    exerciseId: string,
    opts: { targetSets?: number; targetReps?: number; supersetGroup?: number | null; restSeconds?: number | null } = {}
  ): Promise<TemplateExerciseDocument> {
    const db  = getDatabase()
    const now = new Date().toISOString()
    // Determine next position
    const existing = await getTemplateExercises(templateId)
    const position = existing.length

    const te: TemplateExerciseDocument = {
      id:             uuidv4(),
      template_id:    templateId,
      exercise_id:    exerciseId,
      position,
      target_sets:    opts.targetSets ?? 3,
      target_reps:    opts.targetReps ?? null,
      target_rpe:     null,
      notes:          null,
      superset_group: opts.supersetGroup ?? null,
      rest_seconds:   opts.restSeconds ?? null,
      updated_at:     now,
    }
    await db.template_exercises.insert(te)
    // Touch parent template so replication picks it up
    await db.workout_templates.findOne(templateId).update({ $set: { updated_at: now } })
    return te
  }

  async function updateTemplateExercise(
    id: string,
    updates: Partial<Pick<TemplateExerciseDocument, 'target_sets' | 'target_reps' | 'position' | 'notes' | 'superset_group' | 'rest_seconds'>>
  ) {
    const db = getDatabase()
    await db.template_exercises.findOne(id).update({ $set: { ...updates, updated_at: new Date().toISOString() } })
  }

  async function removeExerciseFromTemplate(id: string) {
    const db = getDatabase()
    await db.template_exercises.findOne(id).remove()
  }

  async function reorderTemplateExercises(templateId: string, orderedIds: string[]) {
    const db  = getDatabase()
    const now = new Date().toISOString()
    for (let i = 0; i < orderedIds.length; i++) {
      await db.template_exercises.findOne(orderedIds[i]).update({ $set: { position: i, updated_at: now } })
    }
  }

  async function setPublic(id: string, isPublic: boolean) {
    const db = getDatabase()
    await db.workout_templates.findOne(id).update({
      $set: { is_public: isPublic, visibility: isPublic ? 'public' : 'private', updated_at: new Date().toISOString() },
    })
  }

  async function duplicateTemplate(templateId: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const original = templates.value.find(t => t.id === templateId)
    if (!original) throw new Error('Template not found')
    const db  = getDatabase()
    const now = new Date().toISOString()
    const newId = uuidv4()
    const newTmpl: WorkoutTemplateDocument = {
      id: newId, owner_id: user.id, assigned_by: null,
      name: original.name + ' (Copy)', notes: original.notes,
      is_public: false, visibility: 'private', updated_at: now, folder_name: null,
    }
    await db.workout_templates.insert(newTmpl)
    const exercises = await getTemplateExercises(templateId)
    for (const te of exercises) {
      await db.template_exercises.insert({ ...te, id: uuidv4(), template_id: newId, updated_at: now })
    }
    return newId
  }

  // Save a finished workout's exercises into a template (create or update)
  async function saveWorkoutAsTemplate(
    name: string,
    exerciseIds: string[],
    existingTemplateId?: string
  ): Promise<string> {
    const db = getDatabase()
    const now = new Date().toISOString()
    let templateId = existingTemplateId

    if (!templateId) {
      const tmpl = await createTemplate(name)
      if (!tmpl) throw new Error('Could not create template')
      templateId = tmpl.id
    }

    // Clear existing exercises
    const existing = await db.template_exercises.find({ selector: { template_id: { $eq: templateId } } }).exec()
    for (const ex of existing) await ex.remove()

    // Re-insert from workout
    for (let i = 0; i < exerciseIds.length; i++) {
      const te: TemplateExerciseDocument = {
        id: uuidv4(), template_id: templateId!, exercise_id: exerciseIds[i],
        position: i, target_sets: 3, target_reps: null, target_rpe: null, notes: null,
        superset_group: null, rest_seconds: null, updated_at: now,
      }
      await db.template_exercises.insert(te)
    }
    return templateId!
  }

  return {
    templates, isLoading, FREE_LIMIT,
    canCreate, createTemplate, updateTemplate, deleteTemplate, subscribeToTemplates,
    getTemplateExercises, addExerciseToTemplate, updateTemplateExercise,
    removeExerciseFromTemplate, reorderTemplateExercises, saveWorkoutAsTemplate,
    setPublic, duplicateTemplate, moveToFolder,
  }
})
