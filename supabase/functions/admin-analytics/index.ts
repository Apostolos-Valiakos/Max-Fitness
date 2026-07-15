/**
 * admin-analytics — Supabase Edge Function
 *
 * Backs every tab of the admin portal's /analytics page. Replaces ~15
 * direct service-role table queries the browser used to make itself,
 * moving both the querying AND the chart-shaping server-side (the frontend
 * used to do all of this client-side against a bypass-RLS client — now it
 * just renders whatever this function returns).
 *
 * POST /functions/v1/admin-analytics
 * Headers: Authorization: Bearer <user-jwt>
 * Body:    { tab: 'overview'|'growth'|'revenue'|'engagement'|'trainers'|'content', gym_id: string|null }
 *
 * Caller must be role 'admin' or 'owner'. gym_id scopes results to one gym;
 * null means every gym (only meaningful for an 'owner').
 *
 * Each tab is handled independently and re-derives whatever base data
 * (profiles / recent sessions+sets) it needs from scratch — a bit more DB
 * work than the original's cross-tab caching, but far simpler and safer to
 * get right than a stateful multi-request protocol, and analytics tab
 * switches aren't a hot path.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  subDays, subMonths, format, startOfMonth, endOfMonth,
  eachWeekOfInterval, endOfWeek, eachMonthOfInterval, differenceInDays,
} from 'https://esm.sh/date-fns@3'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })
  if (req.method !== 'POST') return jsonError('Method not allowed', 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonError('Unauthorized', 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return jsonError('Unauthorized', 401)

  const adminClient = createClient(supabaseUrl, serviceKey)

  const { data: callerProfile } = await adminClient
    .from('profiles')
    .select('role, gym_id')
    .eq('id', user.id)
    .single()

  if (!callerProfile || !['admin', 'owner'].includes(callerProfile.role)) {
    return jsonError('Forbidden', 403)
  }

  let body: any = {}
  try { body = await req.json() } catch { /* */ }
  const tab = body.tab as string
  // An admin is always locked to their own gym regardless of what's passed.
  const gymId: string | null = callerProfile.role === 'admin' ? callerProfile.gym_id : (body.gym_id ?? null)

  try {
    switch (tab) {
      case 'overview':   return jsonOk(await loadOverview(adminClient, gymId))
      case 'growth':     return jsonOk(await loadGrowth(adminClient, gymId))
      case 'revenue':    return jsonOk(await loadRevenue(adminClient, gymId))
      case 'engagement': return jsonOk(await loadEngagement(adminClient, gymId))
      case 'trainers':   return jsonOk(await loadTrainers(adminClient, gymId))
      case 'content':    return jsonOk(await loadContent(adminClient, gymId))
      default: return jsonError('Unknown tab', 400)
    }
  } catch (err) {
    console.error(`[admin-analytics] ${tab} error:`, err)
    return jsonError(String(err), 500)
  }
})

// ── Shared base data ─────────────────────────────────────────────────────────

async function loadProfiles(adminClient: SupabaseClient, gymId: string | null) {
  let q = adminClient.from('profiles').select('id, tier, role, full_name, created_at')
  if (gymId) q = q.eq('gym_id', gymId)
  const { data } = await q
  return data ?? []
}

function gymScope(base: any, userIds: string[] | null) {
  if (userIds === null) return base
  return userIds.length ? base.in('user_id', userIds) : base.eq('user_id', '00000000-0000-0000-0000-000000000000')
}

async function loadSessions84(adminClient: SupabaseClient, userIds: string[] | null) {
  const now = new Date()
  const from = subDays(now, 84)
  let q = adminClient.from('workout_sessions')
    .select('id, user_id, started_at, finished_at, template_id')
    .gte('started_at', from.toISOString()).not('finished_at', 'is', null)
  q = gymScope(q, userIds)
  const { data: sessions } = await q
  const sessions84 = sessions ?? []

  let sets84: any[] = []
  const exMeta84: Record<string, { name: string; body_part: string }> = {}
  const ids = sessions84.map((s: any) => s.id)
  if (ids.length) {
    const { data: setsData } = await adminClient.from('sets')
      .select('session_id, exercise_id, weight_kg, reps').in('session_id', ids)
    sets84 = setsData ?? []
    const exIds = [...new Set(sets84.map(s => s.exercise_id))]
    if (exIds.length) {
      const { data: exData } = await adminClient.from('exercises').select('id, name, body_part').in('id', exIds)
      for (const e of exData ?? []) exMeta84[e.id] = { name: e.name, body_part: e.body_part }
    }
  }
  return { sessions84, sets84, exMeta84 }
}

function makeBar(labels: string[], data: number[], color: string) {
  return { labels, datasets: [{ data, backgroundColor: color + 'aa', borderColor: color, borderWidth: 1, borderRadius: 3 }] }
}
function makeLine(labels: string[], data: number[], color: string) {
  return { labels, datasets: [{ data, borderColor: color, backgroundColor: color + '22', tension: 0.4, fill: true, pointRadius: 2 }] }
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
async function loadOverview(adminClient: SupabaseClient, gymId: string | null) {
  const now  = new Date()
  const from = subDays(now, 84)
  const weeks = eachWeekOfInterval({ start: from, end: now })
  const weekLabels = weeks.map(w => format(w, 'MMM d'))

  const profiles = await loadProfiles(adminClient, gymId)
  const userIds  = profiles.map(p => p.id)
  const scopedIds = gymId ? userIds : null

  const { sessions84, sets84 } = await loadSessions84(adminClient, scopedIds)

  const totalUsers    = profiles.length
  const totalSessions = sessions84.length
  const vol = sets84.reduce((a, s) => a + (s.weight_kg ?? 0) * (s.reps ?? 0), 0)
  const totalVolume   = Math.round(vol).toLocaleString()
  const from7 = subDays(now, 7).toISOString()
  const activeThisWeek = new Set(sessions84.filter(s => s.started_at >= from7).map(s => s.user_id)).size

  const sessWeekly = weeks.map(w => {
    const end = endOfWeek(w)
    return sessions84.filter(s => s.started_at >= w.toISOString() && s.started_at <= end.toISOString()).length
  })

  const signupWeekly = weeks.map(w => {
    const end = endOfWeek(w).toISOString()
    return profiles.filter(p => p.created_at >= w.toISOString() && p.created_at <= end).length
  })

  return {
    totalUsers, totalSessions, totalVolume, activeThisWeek,
    sessionsChart: makeBar(weekLabels, sessWeekly, '#4A9EFF'),
    signupsChart:  makeLine(weekLabels, signupWeekly, '#4A9EFF'),
  }
}

// ── GROWTH ────────────────────────────────────────────────────────────────────
async function loadGrowth(adminClient: SupabaseClient, gymId: string | null) {
  const profiles = await loadProfiles(adminClient, gymId)
  const userIds  = profiles.map(p => p.id)
  const scopedIds = gymId ? userIds : null

  const now   = new Date()
  const from7  = subDays(now, 7).toISOString()
  const from30 = subDays(now, 30).toISOString()
  const from90 = subDays(now, 90).toISOString()

  const [s7Res, s30Res, s90Res, everRes] = await Promise.all([
    gymScope(adminClient.from('workout_sessions').select('user_id').gte('started_at', from7).not('finished_at', 'is', null), scopedIds),
    gymScope(adminClient.from('workout_sessions').select('user_id').gte('started_at', from30).not('finished_at', 'is', null), scopedIds),
    gymScope(adminClient.from('workout_sessions').select('user_id').gte('started_at', from90).not('finished_at', 'is', null), scopedIds),
    gymScope(adminClient.from('workout_sessions').select('user_id').lt('started_at', from30).not('finished_at', 'is', null), scopedIds),
  ])

  const active7Set  = new Set((s7Res.data  ?? []).map((s: any) => s.user_id))
  const active30Set = new Set((s30Res.data ?? []).map((s: any) => s.user_id))
  const active90Set = new Set((s90Res.data ?? []).map((s: any) => s.user_id))
  const everSet     = new Set((everRes.data ?? []).map((s: any) => s.user_id))

  const active7  = active7Set.size
  const active30 = active30Set.size
  const active90 = active90Set.size
  const churned  = [...everSet].filter(id => !active30Set.has(id)).length
  const neverTrained = profiles.filter(p => !active90Set.has(p.id) && !everSet.has(p.id)).length

  const thisMonth = startOfMonth(now)
  const newThisMonth = profiles.filter(p => p.created_at >= thisMonth.toISOString()).length

  const months = eachMonthOfInterval({ start: subMonths(now, 11), end: now })
  const monthLabels = months.map(m => format(m, 'MMM yy'))
  const signupsByMonthData = months.map(m => {
    const end = endOfMonth(m).toISOString()
    return profiles.filter(p => p.created_at >= m.toISOString() && p.created_at <= end).length
  })

  const freeCount  = profiles.filter(p => p.tier === 'free').length
  const paidCount  = profiles.filter(p => p.tier === 'paid').length
  const ultraCount = profiles.filter(p => p.tier === 'ultra').length

  return {
    newThisMonth, active7, active30, active90, churned, neverTrained,
    signupsByMonth: makeBar(monthLabels, signupsByMonthData, '#4A9EFF'),
    tierChart: {
      labels: ['Users'],
      datasets: [
        { label: 'Free',  data: [freeCount],  backgroundColor: '#3A3A3C', borderColor: '#636366', borderWidth: 1 },
        { label: 'Paid',  data: [paidCount],  backgroundColor: 'rgba(77,166,255,0.7)', borderColor: '#4DA6FF', borderWidth: 1 },
        { label: 'Ultra', data: [ultraCount], backgroundColor: 'rgba(255,215,0,0.7)',   borderColor: '#FFD700', borderWidth: 1 },
      ],
    },
  }
}

// ── REVENUE ───────────────────────────────────────────────────────────────────
async function loadRevenue(adminClient: SupabaseClient, gymId: string | null) {
  const profiles = await loadProfiles(adminClient, gymId)
  const freeCount  = profiles.filter(p => p.tier === 'free').length
  const paidCount  = profiles.filter(p => p.tier === 'paid').length
  const ultraCount = profiles.filter(p => p.tier === 'ultra').length
  // €4.99/mo (paid) and €9.99/mo (ultra) — must match the live Stripe prices
  // (STRIPE_PRICE_USER_PAID / STRIPE_PRICE_USER_ULTRA in supabase/functions/.env).
  const mrr        = Math.round((paidCount * 4.99 + ultraCount * 9.99) * 100) / 100

  const tierChart = makeBar(['Free', 'Paid', 'Ultra'], [freeCount, paidCount, ultraCount], '#4A9EFF')
  tierChart.datasets[0].backgroundColor = ['#3A3A3C', 'rgba(77,166,255,0.7)', 'rgba(255,215,0,0.7)'] as any
  tierChart.datasets[0].borderColor     = ['#636366', '#4DA6FF', '#FFD700'] as any

  const revenueChart = makeBar(['Paid (€4.99)', 'Ultra (€9.99)'], [paidCount * 4.99, ultraCount * 9.99], '#34C759')

  return { mrr, ultraCount, paidCount, freeCount, tierChart, revenueChart }
}

// ── ENGAGEMENT ────────────────────────────────────────────────────────────────
async function loadEngagement(adminClient: SupabaseClient, gymId: string | null) {
  const profiles = await loadProfiles(adminClient, gymId)
  const scopedIds = gymId ? profiles.map(p => p.id) : null
  const { sessions84, sets84 } = await loadSessions84(adminClient, scopedIds)

  const now  = new Date()
  const from = subDays(now, 84)
  const weeks = eachWeekOfInterval({ start: from, end: now })
  const weekLabels = weeks.map(w => format(w, 'MMM d'))

  let avgDuration = '—'
  const finished = sessions84.filter(s => s.finished_at)
  if (finished.length) {
    const totalMs = finished.reduce((a, s) => a + (new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()), 0)
    avgDuration = Math.round(totalMs / finished.length / 60000).toString()
  }

  let avgSets = '—'
  if (sessions84.length) avgSets = (sets84.length / sessions84.length).toFixed(1)

  const dowCounts = Array(7).fill(0)
  for (const s of sessions84) dowCounts[new Date(s.started_at).getDay()]++
  const peakDay = DAYS[dowCounts.indexOf(Math.max(...dowCounts))]
  const dowChart = makeBar(DAYS, dowCounts, '#4A9EFF')

  const hourCounts = Array(24).fill(0)
  for (const s of sessions84) hourCounts[new Date(s.started_at).getHours()]++
  const peakHour = `${hourCounts.indexOf(Math.max(...hourCounts))}:00`

  const days: string[] = []
  const dayCounts: number[] = []
  const dayMap: Record<string, number> = {}
  for (const s of sessions84) {
    const d = s.started_at.slice(0, 10)
    dayMap[d] = (dayMap[d] ?? 0) + 1
  }
  let cursor = new Date(from)
  while (cursor <= now) {
    const key = cursor.toISOString().slice(0, 10)
    days.push(format(cursor, 'MMM d'))
    dayCounts.push(dayMap[key] ?? 0)
    cursor = new Date(cursor.getTime() + 86400000)
  }
  const dailyChart = makeBar(days, dayCounts, '#4A9EFF')

  const durationWeekly = weeks.map(w => {
    const end = endOfWeek(w)
    const wSess = sessions84.filter(s => s.finished_at && s.started_at >= w.toISOString() && s.started_at <= end.toISOString())
    if (!wSess.length) return 0
    const ms = wSess.reduce((a, s) => a + (new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()), 0)
    return Math.round(ms / wSess.length / 60000)
  })
  const durationChart = makeLine(weekLabels, durationWeekly, '#34C759')

  return { avgDuration, avgSets, peakDay, peakHour, dailyChart, dowChart, durationChart }
}

// ── TRAINERS ──────────────────────────────────────────────────────────────────
async function loadTrainers(adminClient: SupabaseClient, gymId: string | null) {
  const profiles = await loadProfiles(adminClient, gymId)
  const trainerProfiles = profiles.filter(p => p.role === 'trainer' || p.role === 'admin')
  const trainerIds = trainerProfiles.map(p => p.id)
  if (!trainerIds.length) return { totalTrainers: 0, totalClients: 0, avgClientsPerTrainer: '—', overallCompletionPct: 0, rows: [], overdue: [] }

  const nameMap: Record<string, string> = {}
  for (const p of trainerProfiles) nameMap[p.id] = p.full_name ?? '—'

  const [assignRes, caRes, subRes] = await Promise.all([
    adminClient.from('trainer_assignments').select('trainer_id, client_id').eq('is_active', true).in('trainer_id', trainerIds),
    adminClient.from('checkin_assignments').select('id, trainer_id').eq('is_active', true).in('trainer_id', trainerIds),
    adminClient.from('checkin_submissions').select('id, trainer_id, created_at, trainer_replied_at, trainer_reply').in('trainer_id', trainerIds),
  ])

  const assignments   = assignRes.data ?? []
  const caAssignments = caRes.data ?? []
  const submissions   = subRes.data ?? []

  let totalSub = 0, totalAssigned = 0

  const rows = trainerProfiles.map(p => {
    const clientCount = assignments.filter((a: any) => a.trainer_id === p.id).length
    const assigned    = caAssignments.filter((a: any) => a.trainer_id === p.id).length
    const subs        = submissions.filter((s: any) => s.trainer_id === p.id)
    const submitted   = subs.length
    const rate        = assigned ? Math.round(submitted / assigned * 100) : 0
    totalSub      += submitted
    totalAssigned += assigned

    const replied = subs.filter((s: any) => s.trainer_replied_at)
    let avgReply = '—'
    if (replied.length) {
      const avgMs = replied.reduce((a: number, s: any) => a + (new Date(s.trainer_replied_at).getTime() - new Date(s.created_at).getTime()), 0) / replied.length
      const mins = Math.round(avgMs / 60000)
      avgReply = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`
    }

    return { id: p.id, full_name: p.full_name, clientCount, assigned, submitted, rate, avgReply }
  })

  const totalTrainers = trainerProfiles.length
  const totalClients  = new Set(assignments.map((a: any) => a.client_id)).size
  const avgClientsPerTrainer = totalTrainers ? (totalClients / totalTrainers).toFixed(1) : '—'
  const overallCompletionPct = totalAssigned ? Math.round(totalSub / totalAssigned * 100) : 0

  const cutoff = subDays(new Date(), 1)
  const overdue = submissions
    .filter((s: any) => !s.trainer_reply && new Date(s.created_at) < cutoff)
    .map((s: any) => ({
      id: s.id,
      trainerName: nameMap[s.trainer_id] ?? '—',
      created_at: s.created_at,
      waitDays: differenceInDays(new Date(), new Date(s.created_at)),
    }))
    .sort((a: any, b: any) => b.waitDays - a.waitDays)

  return { totalTrainers, totalClients, avgClientsPerTrainer, overallCompletionPct, rows, overdue }
}

// ── CONTENT ───────────────────────────────────────────────────────────────────
async function loadContent(adminClient: SupabaseClient, gymId: string | null) {
  const profiles = await loadProfiles(adminClient, gymId)
  const scopedIds = gymId ? profiles.map(p => p.id) : null
  const { sessions84, sets84, exMeta84 } = await loadSessions84(adminClient, scopedIds)

  let allSessQuery = adminClient.from('workout_sessions').select('template_id, user_id').not('template_id', 'is', null)
  allSessQuery = gymScope(allSessQuery, scopedIds)

  let templatesQuery = adminClient.from('workout_templates').select('id, name, owner_id, is_public')
  if (gymId) templatesQuery = templatesQuery.eq('gym_id', gymId)

  const [allSessRes, templatesRes, exercisesRes] = await Promise.all([
    allSessQuery,
    templatesQuery,
    adminClient.from('exercises').select('id, name, body_part, created_by'),
  ])

  const allSess   = allSessRes.data ?? []
  const templates = templatesRes.data ?? []
  const exercises = exercisesRes.data ?? []

  const totalSessionsAllTime = allSess.length + sessions84.filter((s: any) => !s.template_id).length
  const templateCount  = templates.length
  const customExCount  = exercises.filter((e: any) => e.created_by !== null).length
  const globalExCount  = exercises.filter((e: any) => e.created_by === null).length

  const usageMap: Record<string, number> = {}
  for (const s of allSess) usageMap[s.template_id] = (usageMap[s.template_id] ?? 0) + 1
  const topTemplates = templates
    .map((t: any) => ({ id: t.id, name: t.name, count: usageMap[t.id] ?? 0 }))
    .filter((t: any) => t.count > 0)
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10)

  const exMap: Record<string, { sets: number; volume: number }> = {}
  for (const s of sets84) {
    if (!exMap[s.exercise_id]) exMap[s.exercise_id] = { sets: 0, volume: 0 }
    exMap[s.exercise_id].sets++
    exMap[s.exercise_id].volume += (s.weight_kg ?? 0) * (s.reps ?? 0)
  }
  const topExercises = Object.entries(exMap)
    .map(([id, stats]) => ({
      id, ...stats,
      name:      exMeta84[id]?.name      ?? 'Custom',
      body_part: exMeta84[id]?.body_part ?? 'other',
    }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 15)

  const muscleMap: Record<string, number> = {}
  for (const s of sets84) {
    const bp = exMeta84[s.exercise_id]?.body_part ?? 'other'
    muscleMap[bp] = (muscleMap[bp] ?? 0) + 1
  }
  const muscleEntries = Object.entries(muscleMap).sort((a, b) => b[1] - a[1])
  const muscleChart = {
    labels: muscleEntries.map(([k]) => k.replace('_', ' ')),
    datasets: [{
      data: muscleEntries.map(([, v]) => v),
      backgroundColor: 'rgba(74,158,255,0.6)',
      borderColor: '#4A9EFF',
      borderWidth: 1,
      borderRadius: 3,
    }],
  }

  return { templateCount, totalSessionsAllTime, customExCount, globalExCount, topTemplates, topExercises, muscleChart }
}

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() } })
}
function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } })
}
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
