/**
 * src/stores/sessionStore.ts
 *
 * Pinia store for workout sessions.
 * All reads come from RxDB (local, instant, offline-capable).
 * All writes go to RxDB first — replication pushes to Supabase in background.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '@/lib/rxdb/database'
import { supabase } from '@/lib/supabase'
import type { WorkoutSessionDocument, SetDocument } from '@/lib/rxdb/schemas'

export const useSessionStore = defineStore('sessions', () => {

  // ── State ──────────────────────────────────────────────────────────────────
  const recentSessions  = ref<WorkoutSessionDocument[]>([])
  const activeSession   = ref<WorkoutSessionDocument | null>(null)
  const activeSets      = ref<SetDocument[]>([])
  const isLoading       = ref(false)

  // ── Computed ───────────────────────────────────────────────────────────────
  const hasActiveSession = computed(() => activeSession.value !== null)
  const isSessionFinished = computed(() =>
    activeSession.value?.finished_at != null
  )

  // ── Subscribe to recent sessions from RxDB (reactive) ─────────────────────
  // Call this once after DB is initialized.
  function subscribeToRecentSessions() {
    const db = getDatabase()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    db.workout_sessions
      .find({
        selector: {
          deleted:    { $eq: false },
          started_at: { $gte: thirtyDaysAgo.toISOString() },
        },
        sort: [{ started_at: 'desc' }],
      })
      .$ // RxJS Observable — emits every time data changes
      .subscribe(sessions => {
        recentSessions.value = sessions.map(s => s.toJSON())
      })
  }

  // ── Subscribe to sets for the active session ───────────────────────────────
  function subscribeToActiveSets(sessionId: string) {
    const db = getDatabase()

    db.sets
      .find({
        selector: {
          session_id: { $eq: sessionId },
          deleted:    { $eq: false },
        },
        sort: [{ set_number: 'asc' }],
      })
      .$
      .subscribe(sets => {
        activeSets.value = sets.map(s => s.toJSON())
      })
  }

  // ── Start a new workout session ────────────────────────────────────────────
  async function startSession(name: string, templateId?: string): Promise<WorkoutSessionDocument> {
    const db = getDatabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const now = new Date().toISOString()
    const session: WorkoutSessionDocument = {
      id:          uuidv4(),
      user_id:     user.id,
      template_id: templateId ?? null,
      name,
      started_at:  now,
      finished_at: null,
      updated_at:  now,
      
    }

    await db.workout_sessions.insert(session)
    activeSession.value = session
    subscribeToActiveSets(session.id)

    return session
  }

  // ── Finish the active session ──────────────────────────────────────────────
  async function finishSession() {
    if (!activeSession.value) return
    const db = getDatabase()

    const now = new Date().toISOString()
    await db.workout_sessions
      .findOne(activeSession.value.id)
      .update({
        $set: {
          finished_at: now,
          updated_at:  now,
        },
      })

    activeSession.value = { ...activeSession.value, finished_at: now }
  }

  // ── Log a set ──────────────────────────────────────────────────────────────
  async function logSet(params: {
    exerciseId:   string
    setNumber:    number
    setType?:     SetDocument['set_type']
    weightKg?:    number
    reps?:        number
    rpe?:         number
    durationSecs?: number
    notes?:       string
  }): Promise<SetDocument> {
    if (!activeSession.value) throw new Error('No active session')
    const db = getDatabase()

    const now = new Date().toISOString()
    const set: SetDocument = {
      id:            uuidv4(),
      session_id:    activeSession.value.id,
      exercise_id:   params.exerciseId,
      set_number:    params.setNumber,
      set_type:      params.setType ?? 'working',
      weight_kg:     params.weightKg ?? null,
      reps:          params.reps ?? null,
      rpe:           params.rpe ?? null,
      duration_secs: params.durationSecs ?? null,
      distance_m:    null,
      notes:         params.notes ?? null,
      logged_at:     now,
      updated_at:    now,
      
    }

    await db.sets.insert(set)
    return set
  }

  // ── Delete a set (soft-delete) ─────────────────────────────────────────────
  async function deleteSet(setId: string) {
    const db = getDatabase()
    const now = new Date().toISOString()

    await db.sets.findOne(setId).update({
      $set: { deleted: true, updated_at: now },
    })
  }

  // ── Delete a session (soft-delete) ────────────────────────────────────────
  async function deleteSession(sessionId: string) {
    const db = getDatabase()
    const now = new Date().toISOString()

    await db.workout_sessions.findOne(sessionId).update({
      $set: { deleted: true, updated_at: now },
    })

    if (activeSession.value?.id === sessionId) {
      activeSession.value = null
      activeSets.value    = []
    }
  }

  // ── Resume an existing session (app reopen mid-workout) ───────────────────
  async function resumeSession(sessionId: string) {
    const db = getDatabase()
    const doc = await db.workout_sessions.findOne(sessionId).exec()
    if (!doc) return

    activeSession.value = doc.toJSON()
    subscribeToActiveSets(sessionId)
  }

  return {
    // State
    recentSessions,
    activeSession,
    activeSets,
    isLoading,
    // Computed
    hasActiveSession,
    isSessionFinished,
    // Actions
    subscribeToRecentSessions,
    startSession,
    finishSession,
    logSet,
    deleteSet,
    deleteSession,
    resumeSession,
  }
})
