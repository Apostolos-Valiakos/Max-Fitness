import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDatabase } from '@/lib/rxdb/database'
import { loadOlderSessions } from '@/lib/rxdb/replication'
import type { WorkoutSessionDocument, SetDocument } from '@/lib/rxdb/schemas'
import { isThisWeek, isThisMonth } from 'date-fns'

export interface SessionWithSets extends WorkoutSessionDocument {
  sets: SetDocument[]
  exerciseNames: string[]
  totalVolume: number
}

export const useHistoryStore = defineStore('history', () => {
  const sessions    = ref<WorkoutSessionDocument[]>([])
  const isLoading   = ref(false)
  const canLoadMore = ref(true)

  function subscribeToSessions(userId: string) {
    const db = getDatabase()
    db.workout_sessions
      .find({ selector: { user_id: { $eq: userId }, finished_at: { $ne: null } }, sort: [{ started_at: 'desc' }] })
      .$.subscribe(docs => { sessions.value = docs.map(d => d.toJSON()) })
  }

  async function loadMore() {
    if (!canLoadMore.value || isLoading.value) return
    isLoading.value = true
    const oldest = sessions.value.at(-1)?.started_at ?? new Date().toISOString()
    const more = await loadOlderSessions(oldest)
    canLoadMore.value = more; isLoading.value = false
  }

  async function getSessionWithSets(sessionId: string): Promise<SessionWithSets | null> {
    const db = getDatabase()
    const session = await db.workout_sessions.findOne(sessionId).exec()
    if (!session) return null
    const sets = await db.sets.find({ selector: { session_id: { $eq: sessionId } } }).exec()
    const setDocs = sets.map(s => s.toJSON())
    const exerciseIds = [...new Set(setDocs.map(s => s.exercise_id))]
    const exercises   = await db.exercises.find({ selector: { id: { $in: exerciseIds } } }).exec()
    const nameMap     = Object.fromEntries(exercises.map(e => [e.id, e.name]))
    return { ...session.toJSON(), sets: setDocs, exerciseNames: exerciseIds.map(id => nameMap[id] ?? 'Unknown'), totalVolume: setDocs.reduce((a, s) => a + ((s.weight_kg ?? 0) * (s.reps ?? 0)), 0) }
  }

  function getCurrentStreak(): number {
    if (!sessions.value.length) return 0
    let streak = 0
    // Only count completed sessions for streak purposes
    const completed = sessions.value.filter(s => s.is_completed && s.finished_at)
    const dates = completed.map(s => { const d = new Date(s.started_at); d.setHours(0,0,0,0); return d.getTime() })
    const unique = [...new Set(dates)].sort((a,b) => b-a)
    const today  = new Date(); today.setHours(0,0,0,0)
    let expected = today.getTime()
    for (const d of unique) {
      if (d === expected || d === expected - 86400000) { streak++; expected = d - 86400000 } else break
    }
    return streak
  }

  function getWeeklyCount()  { return sessions.value.filter(s => isThisWeek(new Date(s.started_at))).length }
  function getMonthlyCount() { return sessions.value.filter(s => isThisMonth(new Date(s.started_at))).length }

  return { sessions, isLoading, canLoadMore, subscribeToSessions, loadMore, getSessionWithSets, getCurrentStreak, getWeeklyCount, getMonthlyCount }
})
