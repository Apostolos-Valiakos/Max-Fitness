import { getDatabase } from '@/lib/rxdb/database'
import { format, subDays, eachWeekOfInterval, startOfWeek, endOfWeek } from 'date-fns'

// Volume over time for a single exercise (last 12 weeks)
export async function getVolumeChartData(exerciseId: string) {
  const db   = getDatabase()
  const from = subDays(new Date(), 84).toISOString()
  const sets = await db.sets.find({
    selector: { exercise_id: { $eq: exerciseId }, logged_at: { $gte: from } },
  }).exec()

  const weekMap = new Map<string, number>()
  for (const s of sets) {
    const d = s.toJSON()
    const week = format(startOfWeek(new Date(d.logged_at)), 'MMM d')
    weekMap.set(week, (weekMap.get(week) ?? 0) + ((d.weight_kg ?? 0) * (d.reps ?? 0)))
  }

  const labels  = Array.from(weekMap.keys())
  const values  = Array.from(weekMap.values())
  return { labels, datasets: [{ label: 'Volume (kg)', data: values, borderColor: '#4A9EFF', backgroundColor: 'rgba(74,158,255,0.1)', tension: 0.4, fill: true }] }
}

// Workout frequency last 12 weeks
export async function getFrequencyChartData(userId: string) {
  const db   = getDatabase()
  const from = subDays(new Date(), 84).toISOString()
  const sessions = await db.workout_sessions.find({
    selector: { user_id: { $eq: userId }, started_at: { $gte: from }, finished_at: { $ne: null } },
  }).exec()

  const weeks = eachWeekOfInterval({ start: subDays(new Date(), 84), end: new Date() })
  const labels  = weeks.map(w => format(w, 'MMM d'))
  const values  = weeks.map(w => {
    const end = endOfWeek(w)
    return sessions.filter(s => {
      const d = new Date(s.started_at)
      return d >= w && d <= end
    }).length
  })

  return { labels, datasets: [{ label: 'Workouts', data: values, backgroundColor: 'rgba(74,158,255,0.6)', borderColor: '#4A9EFF', borderWidth: 1, borderRadius: 4 }] }
}

// Volume by muscle group — last 30 days
export async function getMuscleVolumeData(userId: string, days = 30) {
  const db   = getDatabase()
  const from = subDays(new Date(), days).toISOString()

  const sessions = await db.workout_sessions.find({
    selector: { user_id: { $eq: userId }, started_at: { $gte: from }, finished_at: { $ne: null } },
  }).exec()
  const sessionIds = sessions.map(s => s.id)
  if (!sessionIds.length) return null

  const sets = await db.sets.find({ selector: { session_id: { $in: sessionIds } } }).exec()
  const exercises = await db.exercises.find({}).exec()
  const exMap = Object.fromEntries(exercises.map(e => [e.id, e.body_part]))

  const volumeByPart: Record<string, number> = {}
  for (const s of sets) {
    const d = s.toJSON()
    const bp = exMap[d.exercise_id] ?? 'other'
    volumeByPart[bp] = (volumeByPart[bp] ?? 0) + ((d.weight_kg ?? 0) * (d.reps ?? 0))
  }

  const sorted = Object.entries(volumeByPart).sort((a, b) => b[1] - a[1])
  const labels = sorted.map(([bp]) => bp.replace('_', ' '))
  const values = sorted.map(([, v]) => Math.round(v))

  return {
    labels,
    datasets: [{
      label: 'Volume (kg)',
      data: values,
      backgroundColor: 'rgba(74,158,255,0.7)',
      borderColor: '#4A9EFF',
      borderWidth: 1,
      borderRadius: 3,
    }],
  }
}

// Estimated 1RM over time for a single exercise (last 12 weeks, best per session)
export async function getStrengthChartData(exerciseId: string) {
  const db   = getDatabase()
  const from = subDays(new Date(), 84).toISOString()
  const sets = await db.sets.find({
    selector: { exercise_id: { $eq: exerciseId }, logged_at: { $gte: from }, set_type: { $eq: 'working' } },
    sort: [{ logged_at: 'asc' }],
  }).exec()

  const sessionBest = new Map<string, { date: string; e1rm: number }>()
  for (const s of sets) {
    const d = s.toJSON()
    if (!d.weight_kg || !d.reps) continue
    const e1rm = d.reps === 1 ? d.weight_kg : Math.round(d.weight_kg * (1 + d.reps / 30) * 10) / 10
    const week = format(startOfWeek(new Date(d.logged_at)), 'MMM d')
    const cur = sessionBest.get(week)
    if (!cur || e1rm > cur.e1rm) sessionBest.set(week, { date: week, e1rm })
  }

  const entries = Array.from(sessionBest.values())
  if (!entries.length) return null
  return {
    labels: entries.map(e => e.date),
    datasets: [{
      label: 'Est. 1RM (kg)',
      data:  entries.map(e => e.e1rm),
      borderColor: '#FFB400',
      backgroundColor: 'rgba(255,180,0,0.08)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#FFB400',
    }],
  }
}

// Max weight over time for a single exercise (last 12 weeks, best per session)
export async function getMaxWeightChartData(exerciseId: string) {
  const db   = getDatabase()
  const from = subDays(new Date(), 84).toISOString()
  const sets = await db.sets.find({
    selector: { exercise_id: { $eq: exerciseId }, logged_at: { $gte: from }, set_type: { $eq: 'working' } },
    sort: [{ logged_at: 'asc' }],
  }).exec()

  const weekBest = new Map<string, number>()
  for (const s of sets) {
    const d = s.toJSON()
    if (!d.weight_kg) continue
    const week = format(startOfWeek(new Date(d.logged_at)), 'MMM d')
    weekBest.set(week, Math.max(weekBest.get(week) ?? 0, d.weight_kg))
  }

  const entries = Array.from(weekBest.entries())
  if (!entries.length) return null
  return {
    labels: entries.map(([w]) => w),
    datasets: [{
      label: 'Max Weight (kg)',
      data: entries.map(([, v]) => v),
      borderColor: '#34C759',
      backgroundColor: 'rgba(52,199,89,0.06)',
      tension: 0.4, fill: true,
      pointBackgroundColor: '#34C759',
    }],
  }
}

// Bodyweight trend from array of entries
export function getBodyweightChartData(entries: { date: string; kg: number }[]) {
  return {
    labels:   entries.map(e => format(new Date(e.date), 'MMM d')),
    datasets: [{
      label: 'Bodyweight (kg)', data: entries.map(e => e.kg),
      borderColor: '#4A9EFF', backgroundColor: 'rgba(74,158,255,0.1)', tension: 0.4, fill: true,
    }],
  }
}
