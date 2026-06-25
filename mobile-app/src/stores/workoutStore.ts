import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '@/lib/rxdb/database'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './authStore'
import { getPreviousPerformance } from '@/composables/usePreviousPerformance'
import type { WorkoutSessionDocument, SetDocument, TemplateExerciseDocument } from '@/lib/rxdb/schemas'

export interface ActiveSet extends SetDocument { done?: boolean; isPR?: boolean; restSeconds?: number }
export interface ActiveExercise {
  exerciseId: string
  exerciseName: string
  sets: ActiveSet[]
  // Populated from template_exercises when starting from a template
  templateNotes: string | null
  targetSets: number | null
  targetReps: number | null
  restSeconds: number | null
  // User-entered notes during the workout
  exerciseNotes: string
}

export const useWorkoutStore = defineStore('workout', () => {
  const activeSession   = ref<WorkoutSessionDocument | null>(null)
  const activeExercises = ref<ActiveExercise[]>([])
  const elapsedSeconds  = ref(0)
  const isFinishing     = ref(false)
  // Tracks the exercise IDs used (in order) for "save as template"
  const usedTemplateId  = ref<string | null>(null)
  let timerInterval: ReturnType<typeof setInterval> | null = null

  const hasActiveSession = computed(() => activeSession.value !== null)
  const totalSets        = computed(() => activeExercises.value.reduce((a, e) => a + e.sets.length, 0))
  const totalVolume      = computed(() => activeExercises.value.reduce((a, e) => a + e.sets.reduce((s, x) => s + ((x.weight_kg ?? 0) * (x.reps ?? 0)), 0), 0))
  const elapsedFormatted = computed(() => {
    const h = Math.floor(elapsedSeconds.value / 3600)
    const m = Math.floor((elapsedSeconds.value % 3600) / 60)
    const s = elapsedSeconds.value % 60
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  })

  function startTimer() {
    if (timerInterval) return
    timerInterval = setInterval(() => elapsedSeconds.value++, 1000)
  }
  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
  }

  async function startSession(name: string, templateId?: string) {
    const user = useAuthStore().user
    if (!user) throw new Error('Not authenticated')
    const db  = getDatabase()
    const now = new Date().toISOString()

    const session: WorkoutSessionDocument = {
      id: uuidv4(), user_id: user.id, template_id: templateId ?? null,
      name, started_at: now, finished_at: null, updated_at: now,
      notes: null, is_completed: false,
    }
    await db.workout_sessions.insert(session)
    activeSession.value   = session
    activeExercises.value = []
    usedTemplateId.value  = templateId ?? null
    startTimer()

    // Pre-load exercises from template
    if (templateId) {
      let teDocs: TemplateExerciseDocument[] = []

      // Try RxDB first (works for own templates + synced trainer templates)
      const rxDocs = await db.template_exercises
        .find({ selector: { template_id: { $eq: templateId } }, sort: [{ position: 'asc' }] })
        .exec()
      teDocs = rxDocs.map(d => d.toJSON())

      // Fallback: fetch from Supabase when RxDB hasn't synced this template yet
      if (teDocs.length === 0) {
        const { data } = await supabase
          .from('template_exercises')
          .select('id,template_id,exercise_id,position,target_sets,target_reps,target_rpe,notes,superset_group,rest_seconds,set_configs,updated_at')
          .eq('template_id', templateId)
          .order('position')
        teDocs = (data ?? []) as TemplateExerciseDocument[]
      }

      for (const teDoc of teDocs) {
        const exerciseDoc = await db.exercises.findOne(teDoc.exercise_id).exec()
        if (!exerciseDoc) continue
        const exercise = exerciseDoc.toJSON()
        const prev     = await getPreviousPerformance(teDoc.exercise_id, session.id)

        let ex = activeExercises.value.find(e => e.exerciseId === teDoc.exercise_id)
        if (!ex) {
          ex = {
            exerciseId:    teDoc.exercise_id,
            exerciseName:  exercise.name,
            sets:          [],
            templateNotes: teDoc.notes ?? null,
            targetSets:    teDoc.target_sets ?? null,
            targetReps:    teDoc.target_reps ?? null,
            restSeconds:   teDoc.rest_seconds ?? null,
            exerciseNotes: '',
          }
          activeExercises.value.push(ex)
        }

        // set_configs (per-set types) takes priority over flat target_sets/target_reps
        const configs = teDoc.set_configs
        if (configs && configs.length > 0) {
          for (let i = 0; i < configs.length; i++) {
            const cfg = configs[i]
            const set: ActiveSet = {
              id: uuidv4(), session_id: session.id, exercise_id: teDoc.exercise_id,
              set_number: i + 1, set_type: cfg.set_type as SetDocument['set_type'],
              weight_kg: prev?.weight_kg ?? null,
              reps:      cfg.target_reps ?? prev?.reps ?? null,
              rpe: null, duration_secs: null, distance_m: null, notes: null,
              logged_at: now, updated_at: now, done: false,
            }
            const { done: _done, ...dbSet } = set
            await db.sets.insert(dbSet)
            ex.sets.push(set)
          }
        } else {
          const numSets = teDoc.target_sets ?? 3
          for (let i = 0; i < numSets; i++) {
            const set: ActiveSet = {
              id: uuidv4(), session_id: session.id, exercise_id: teDoc.exercise_id,
              set_number: i + 1, set_type: 'working',
              weight_kg: prev?.weight_kg ?? null,
              reps:      teDoc.target_reps ?? prev?.reps ?? null,
              rpe: null, duration_secs: null, distance_m: null, notes: null,
              logged_at: now, updated_at: now, done: false,
            }
            const { done: _done, ...dbSet } = set
            await db.sets.insert(dbSet)
            ex.sets.push(set)
          }
        }
      }
    }
  }

  async function addExercise(exerciseId: string, exerciseName: string) {
    if (activeExercises.value.find(e => e.exerciseId === exerciseId)) return
    activeExercises.value.push({
      exerciseId, exerciseName, sets: [],
      templateNotes: null, targetSets: null, targetReps: null, restSeconds: null, exerciseNotes: '',
    })
  }

  async function removeExercise(exerciseId: string) {
    const db  = getDatabase()
    const ex  = activeExercises.value.find(e => e.exerciseId === exerciseId)
    if (ex) for (const set of ex.sets) await db.sets.findOne(set.id).remove()
    activeExercises.value = activeExercises.value.filter(e => e.exerciseId !== exerciseId)
  }

  async function logSet(params: {
    exerciseId: string; exerciseName: string; setType: SetDocument['set_type']
    weightKg: number | null; reps: number | null; rpe: number | null; notes: string | null
  }): Promise<ActiveSet> {
    if (!activeSession.value) throw new Error('No active session')
    const db  = getDatabase()
    const now = new Date().toISOString()

    let ex = activeExercises.value.find(e => e.exerciseId === params.exerciseId)
    if (!ex) {
      ex = {
        exerciseId: params.exerciseId, exerciseName: params.exerciseName, sets: [],
        templateNotes: null, targetSets: null, targetReps: null, restSeconds: null, exerciseNotes: '',
      }
      activeExercises.value.push(ex)
    }

    const set: ActiveSet = {
      id: uuidv4(), session_id: activeSession.value.id, exercise_id: params.exerciseId,
      set_number: ex.sets.length + 1, set_type: params.setType,
      weight_kg: params.weightKg, reps: params.reps, rpe: params.rpe,
      duration_secs: null, distance_m: null, notes: params.notes,
      logged_at: now, updated_at: now, done: false,
    }
    const { done: _done, ...dbSet } = set
    await db.sets.insert(dbSet)
    ex.sets.push(set)
    return set
  }

  async function updateSet(setId: string, updates: Partial<ActiveSet>) {
    const db  = getDatabase()
    const now = new Date().toISOString()
    const { done, isPR, ...dbUpdates } = updates
    await db.sets.findOne(setId).update({ $set: { ...dbUpdates, updated_at: now } })
    for (const ex of activeExercises.value) {
      const s = ex.sets.find(s => s.id === setId)
      if (s) Object.assign(s, updates)
    }
  }

  function markSetDone(setId: string, done: boolean) {
    for (const ex of activeExercises.value) {
      const s = ex.sets.find(s => s.id === setId)
      if (s) { s.done = done; break }
    }
  }

  async function deleteSet(setId: string) {
    const db = getDatabase()
    await db.sets.findOne(setId).remove()
    for (const ex of activeExercises.value) ex.sets = ex.sets.filter(s => s.id !== setId)
  }

  function updateExerciseNotes(exerciseId: string, notes: string) {
    const ex = activeExercises.value.find(e => e.exerciseId === exerciseId)
    if (ex) ex.exerciseNotes = notes
  }

  async function addWarmupSets(exerciseId: string) {
    if (!activeSession.value) return
    const db  = getDatabase()
    const now = new Date().toISOString()
    const ex  = activeExercises.value.find(e => e.exerciseId === exerciseId)
    if (!ex) return

    const maxWeight = ex.sets
      .filter(s => s.set_type === 'working' && s.weight_kg)
      .reduce((m, s) => Math.max(m, s.weight_kg!), 0)
    if (!maxWeight) return

    const warmupSets: ActiveSet[] = []
    for (const [i, pct] of ([0.5, 0.7, 0.9] as const).entries()) {
      const wKg = Math.round(maxWeight * pct * 2) / 2
      const set: ActiveSet = {
        id: uuidv4(), session_id: activeSession.value.id, exercise_id: exerciseId,
        set_number: i + 1, set_type: 'warmup',
        weight_kg: wKg, reps: 10, rpe: null, duration_secs: null, distance_m: null, notes: null,
        logged_at: now, updated_at: now, done: false,
      }
      const { done: _done, ...dbSet } = set
      await db.sets.insert(dbSet)
      warmupSets.push(set)
    }
    ex.sets = [...warmupSets, ...ex.sets]
  }

  async function replaceExercise(oldId: string, newId: string, newName: string) {
    const db  = getDatabase()
    const now = new Date().toISOString()
    const ex  = activeExercises.value.find(e => e.exerciseId === oldId)
    if (!ex) return
    for (const set of ex.sets) {
      await db.sets.findOne(set.id).update({ $set: { exercise_id: newId, updated_at: now } })
      set.exercise_id = newId
    }
    ex.exerciseId    = newId
    ex.exerciseName  = newName
    ex.templateNotes = null
    ex.targetSets    = null
    ex.targetReps    = null
    ex.restSeconds   = null
  }

  async function finishSession(userNotes?: string): Promise<WorkoutSessionDocument> {
    if (!activeSession.value) throw new Error('No active session')
    isFinishing.value = true
    const db  = getDatabase()
    const now = new Date().toISOString()

    const exNoteLines = activeExercises.value
      .filter(e => e.exerciseNotes.trim())
      .map(e => `${e.exerciseName}: ${e.exerciseNotes.trim()}`)
    let combinedNotes: string | null = userNotes?.trim() || null
    if (exNoteLines.length) {
      const section = 'Exercise notes:\n' + exNoteLines.join('\n')
      combinedNotes = combinedNotes ? `${combinedNotes}\n\n${section}` : section
    }

    const patch: Record<string, unknown> = { finished_at: now, updated_at: now, is_completed: true }
    if (combinedNotes !== undefined) patch.notes = combinedNotes
    await db.workout_sessions.findOne(activeSession.value.id).update({ $set: patch })
    const finished = { ...activeSession.value, finished_at: now }
    stopTimer()
    const exerciseIds = activeExercises.value.map(e => e.exerciseId)
    activeSession.value   = null
    activeExercises.value = []
    elapsedSeconds.value  = 0
    isFinishing.value     = false
    return { ...finished, _exerciseIds: exerciseIds } as any
  }

  async function discardSession() {
    if (!activeSession.value) return
    const db = getDatabase()
    for (const ex of activeExercises.value) {
      for (const set of ex.sets) await db.sets.findOne(set.id).remove()
    }
    await db.workout_sessions.findOne(activeSession.value.id).remove()
    stopTimer()
    activeSession.value   = null
    activeExercises.value = []
    elapsedSeconds.value  = 0
    usedTemplateId.value  = null
  }

  async function recoverSession() {
    const user = useAuthStore().user
    if (!user) return
    const db        = getDatabase()
    const unfinished = await db.workout_sessions
      .findOne({ selector: { user_id: { $eq: user.id }, finished_at: { $eq: null } } })
      .exec()
    if (!unfinished) return

    activeSession.value  = unfinished.toJSON()
    usedTemplateId.value = unfinished.template_id ?? null

    const sets = await db.sets.find({ selector: { session_id: { $eq: unfinished.id } } }).exec()
    const map  = new Map<string, ActiveExercise>()
    for (const s of sets) {
      const d = s.toJSON()
      if (!map.has(d.exercise_id)) {
        map.set(d.exercise_id, {
          exerciseId: d.exercise_id, exerciseName: '', sets: [],
          templateNotes: null, targetSets: null, targetReps: null, restSeconds: null, exerciseNotes: '',
        })
      }
      // Recovered sets are shown as done
      map.get(d.exercise_id)!.sets.push({ ...d, done: true })
    }

    // Resolve exercise names
    const db2 = getDatabase()
    for (const [exId, ex] of map) {
      const doc = await db2.exercises.findOne(exId).exec()
      if (doc) ex.exerciseName = doc.name
    }

    activeExercises.value = Array.from(map.values())
    elapsedSeconds.value  = Math.floor((Date.now() - new Date(unfinished.started_at).getTime()) / 1000)
    startTimer()
  }

  // Duplicate a past session into a new active one
  async function duplicateSession(sessionId: string) {
    const db   = getDatabase()
    const sess = await db.workout_sessions.findOne(sessionId).exec()
    if (!sess) return
    const sessData = sess.toJSON()
    const sets     = await db.sets.find({ selector: { session_id: { $eq: sessionId } } }).exec()
    const setData  = sets.map(s => s.toJSON())

    await startSession(sessData.name)
    const exIds = [...new Set(setData.map(s => s.exercise_id))]
    for (const exId of exIds) {
      const exDoc  = await db.exercises.findOne(exId).exec()
      const exName = exDoc?.name ?? 'Unknown'
      const exSets = setData.filter(s => s.exercise_id === exId).sort((a, b) => a.set_number - b.set_number)
      for (const s of exSets) {
        await logSet({ exerciseId: exId, exerciseName: exName, setType: s.set_type, weightKg: s.weight_kg, reps: s.reps, rpe: s.rpe, notes: s.notes })
      }
    }
  }

  function updateSetRest(setId: string, seconds: number) {
    for (const ex of activeExercises.value) {
      const idx = ex.sets.findIndex(s => s.id === setId)
      if (idx !== -1) {
        for (let i = idx; i < ex.sets.length; i++) {
          ex.sets[i].restSeconds = seconds
        }
        break
      }
    }
  }

  async function renameSession(name: string) {
    if (!activeSession.value) return
    const trimmed = name.trim()
    if (!trimmed) return
    const db = getDatabase()
    await db.workout_sessions.findOne(activeSession.value.id).update({ $set: { name: trimmed, updated_at: new Date().toISOString() } })
    activeSession.value = { ...activeSession.value, name: trimmed }
  }

  return {
    activeSession, activeExercises, elapsedSeconds, elapsedFormatted,
    hasActiveSession, totalSets, totalVolume, isFinishing, usedTemplateId,
    startSession, addExercise, removeExercise, logSet, updateSet, markSetDone,
    deleteSet, updateExerciseNotes, updateSetRest, addWarmupSets, replaceExercise,
    finishSession, discardSession, recoverSession, duplicateSession, renameSession,
  }
})
