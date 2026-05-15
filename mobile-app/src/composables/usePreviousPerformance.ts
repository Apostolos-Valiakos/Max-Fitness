import { getDatabase } from '@/lib/rxdb/database'

export interface AllTimeBest {
  weight_kg: number
  reps:      number
  e1rm:      number
}

export interface PreviousPerformance {
  weight_kg:   number | null
  reps:        number | null
  rpe:         number | null
  sessionDate: string
  allTimeBest: AllTimeBest | null
}

function epley(w: number, r: number): number {
  return r === 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10
}

export async function getPreviousPerformance(
  exerciseId: string,
  currentSessionId: string
): Promise<PreviousPerformance | null> {
  const db = getDatabase()

  const sets = await db.sets
    .find({
      selector: { exercise_id: { $eq: exerciseId } },
      sort: [{ logged_at: 'desc' }],
    })
    .exec()

  const docs     = sets.map(s => s.toJSON())
  const external = docs.filter(s => s.session_id !== currentSessionId)

  if (!external.length) return null

  // Last session first working set
  const lastSessionId = external[0].session_id
  const lastWorking   = external.filter(s => s.session_id === lastSessionId && s.set_type === 'working')

  // All-time best e1RM across all sessions (including current)
  let best: AllTimeBest | null = null
  for (const s of docs) {
    if (!s.weight_kg || !s.reps || s.set_type !== 'working') continue
    const e1rm = epley(s.weight_kg, s.reps)
    if (!best || e1rm > best.e1rm) {
      best = { weight_kg: s.weight_kg, reps: s.reps, e1rm }
    }
  }

  const session = lastWorking.length
    ? await db.workout_sessions.findOne(lastSessionId).exec()
    : null

  return {
    weight_kg:   lastWorking[0]?.weight_kg ?? null,
    reps:        lastWorking[0]?.reps      ?? null,
    rpe:         lastWorking[0]?.rpe       ?? null,
    sessionDate: session?.started_at       ?? '',
    allTimeBest: best,
  }
}
