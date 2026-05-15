import { getDatabase } from '@/lib/rxdb/database'

export interface PR {
  exerciseId: string
  weight_kg:  number
  reps:       number
  e1rm:       number  // estimated 1RM via Epley formula
  date:       string
}

// Epley formula: weight * (1 + reps/30)
function calcE1RM(weight: number, reps: number): number {
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

export async function getExercisePR(exerciseId: string): Promise<PR | null> {
  const db   = getDatabase()
  const sets = await db.sets
    .find({ selector: { exercise_id: { $eq: exerciseId }, set_type: { $eq: 'working' } } })
    .exec()

  if (!sets.length) return null

  let best: PR | null = null
  for (const s of sets) {
    const d = s.toJSON()
    if (!d.weight_kg || !d.reps) continue
    const e1rm = calcE1RM(d.weight_kg, d.reps)
    if (!best || e1rm > best.e1rm) {
      best = { exerciseId, weight_kg: d.weight_kg, reps: d.reps, e1rm, date: d.logged_at }
    }
  }
  return best
}

export interface RepRecord {
  reps: number
  weight_kg: number
  e1rm: number
  date: string
}

export async function getRepRecords(exerciseId: string): Promise<RepRecord[]> {
  const db   = getDatabase()
  const sets = await db.sets.find({
    selector: { exercise_id: { $eq: exerciseId }, set_type: { $eq: 'working' } },
  }).exec()

  const best = new Map<number, RepRecord>()
  for (const s of sets) {
    const d = s.toJSON()
    if (!d.weight_kg || !d.reps || d.reps < 1 || d.reps > 12) continue
    const cur = best.get(d.reps)
    if (!cur || d.weight_kg > cur.weight_kg) {
      best.set(d.reps, { reps: d.reps, weight_kg: d.weight_kg, e1rm: calcE1RM(d.weight_kg, d.reps), date: d.logged_at })
    }
  }
  return Array.from(best.values()).sort((a, b) => a.reps - b.reps)
}

export async function checkIsNewPR(exerciseId: string, weightKg: number, reps: number): Promise<boolean> {
  const current = calcE1RM(weightKg, reps)
  const pr = await getExercisePR(exerciseId)
  return !pr || current > pr.e1rm
}
