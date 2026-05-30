/**
 * src/stores/exerciseStore.ts
 * Exercise library — local reads, custom exercise creation, PR lookup.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '@/lib/rxdb/database'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './authStore'

export interface Exercise {
  id: string
  name: string
  body_part: string
  equipment: string
  image_url: string | null
  instructions: string | null
  is_custom: boolean
  created_by: string | null
  updated_at: string
  target_muscle: string | null
  secondary_muscles: string[] | null
  exercise_db_id: string | null
  sticky_note: string | null
}

export const BODY_PARTS = [
  'chest','back','shoulders','biceps','triceps',
  'forearms','quads','hamstrings','glutes','calves','core','full_body',
] as const

export const EQUIPMENT_TYPES = [
  'barbell','dumbbell','cable','machine',
  'bodyweight','kettlebell','band','other',
] as const

export const useExerciseStore = defineStore('exercises', () => {
  const authStore   = useAuthStore()
  const exercises   = ref<Exercise[]>([])
  const searchQuery = ref('')
  const filterBodyPart  = ref<string>('')
  const filterEquipment = ref<string>('')

  const filtered = computed(() => {
    let list = exercises.value
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.body_part.toLowerCase().includes(q)
      )
    }
    if (filterBodyPart.value)
      list = list.filter(e => e.body_part === filterBodyPart.value)
    if (filterEquipment.value)
      list = list.filter(e => e.equipment === filterEquipment.value)
    return list
  })

  function subscribeToExercises() {
    const db = getDatabase()
    db.exercises
      .find({ sort: [{ name: 'asc' }] })
      .$
      .subscribe(docs => {
        exercises.value = docs.map(d => d.toJSON() as Exercise)
      })
  }

  function clearFilters() {
    searchQuery.value     = ''
    filterBodyPart.value  = ''
    filterEquipment.value = ''
  }

  async function createCustomExercise(params: {
    name: string
    body_part: string
    equipment: string
    instructions?: string
  }): Promise<Exercise> {
    const db  = getDatabase()
    const now = new Date().toISOString()

    const exercise: Exercise = {
      id:                uuidv4(),
      name:              params.name,
      body_part:         params.body_part,
      equipment:         params.equipment,
      image_url:         null,
      instructions:      params.instructions ?? null,
      is_custom:         true,
      created_by:        authStore.user?.id ?? null,
      updated_at:        now,
      target_muscle:     null,
      secondary_muscles: null,
      exercise_db_id:    null,
      sticky_note:       null,
    }

    await db.exercises.insert(exercise)
    return exercise
  }

  async function updateStickyNote(exerciseId: string, note: string) {
    const db  = getDatabase()
    const now = new Date().toISOString()
    const trimmed = note.trim() || null

    // Write locally first so it works offline; sync picks it up later
    const doc = await db.exercises.findOne(exerciseId).exec()
    if (doc) await doc.patch({ sticky_note: trimmed, updated_at: now })

    const local = exercises.value.find(e => e.id === exerciseId)
    if (local) local.sticky_note = trimmed

    // Best-effort remote write — silently ignored if offline
    supabase
      .from('exercises')
      .update({ sticky_note: trimmed, updated_at: now })
      .eq('id', exerciseId)
      .then((_res: unknown) => {}, () => {})
  }

  // ── Exercise volume history for chart ─────────────────────────────────────
  async function getVolumeHistory(exerciseId: string) {
    const { data } = await supabase
      .from('sets')
      .select('weight_kg, reps, logged_at, workout_sessions!inner(user_id, started_at)')
      .eq('exercise_id', exerciseId)
      .eq('workout_sessions.user_id', authStore.user?.id)
      .eq('set_type', 'working')
      .eq('deleted', false)
      .order('logged_at', { ascending: true })
      .limit(100)

    return (data ?? []).map((s: any) => ({
      date:   s.logged_at,
      volume: (s.weight_kg ?? 0) * (s.reps ?? 0),
      weight: s.weight_kg ?? 0,
      reps:   s.reps ?? 0,
    }))
  }

  // ── Personal record for one exercise ─────────────────────────────────────
  async function getExercisePR(exerciseId: string) {
    const { data } = await supabase
      .from('sets')
      .select('weight_kg, reps, logged_at, workout_sessions!inner(user_id)')
      .eq('exercise_id', exerciseId)
      .eq('workout_sessions.user_id', authStore.user?.id)
      .eq('set_type', 'working')
      .eq('deleted', false)
      .order('weight_kg', { ascending: false })
      .limit(1)

    return data?.[0] ?? null
  }

  function search(q: string): Exercise[] {
    const lower = q.toLowerCase()
    return exercises.value.filter(e =>
      e.name.toLowerCase().includes(lower) ||
      e.body_part.toLowerCase().includes(lower)
    )
  }

  return {
    exercises, filtered, searchQuery, filterBodyPart, filterEquipment,
    subscribeToExercises, clearFilters, createCustomExercise,
    getVolumeHistory, getExercisePR, search, updateStickyNote,
  }
})
