import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export interface TrainerClient {
  id: string
  full_name: string | null
  tier: 'free' | 'paid' | 'ultra'
  email: string
  last_session_at: string | null
}

export interface WorkoutPlan {
  id: string
  trainer_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  days: PlanDay[]
}

export interface PlanDay {
  day_of_week: number  // 0=Sun … 6=Sat
  template_id: string
  template_name: string
}

export interface PlanAssignment {
  id: string
  plan_id: string
  plan_name: string
  client_id: string
  is_active: boolean
  started_at: string
}

export interface ClientSession {
  id: string
  name: string
  started_at: string
  finished_at: string | null
  duration_secs: number | null
  total_sets: number
  total_volume: number
  feedback: string | null
  feedback_id: string | null
}

export interface TodayTemplate {
  plan_id: string
  plan_name: string
  template_id: string
  template_name: string
  day_of_week: number
}

export const useTrainerStore = defineStore('trainer', () => {
  const clients     = ref<TrainerClient[]>([])
  const plans       = ref<WorkoutPlan[]>([])
  const todayTemplate = ref<TodayTemplate | null>(null)
  const loading     = ref(false)

  // ── Trainer: fetch assigned clients ────────────────────────────────────────
  async function fetchClients() {
    loading.value = true
    const { data: assignments } = await supabase
      .from('trainer_assignments')
      .select('client_id, profiles!trainer_assignments_client_id_fkey(id, full_name, tier)')
      .eq('is_active', true)

    if (!assignments) { loading.value = false; return }

    const clientIds = assignments.map(a => a.client_id)
    let lastSessions: Record<string, string> = {}

    if (clientIds.length) {
      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('user_id, started_at')
        .in('user_id', clientIds)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false })

      for (const s of sessions ?? []) {
        if (!lastSessions[s.user_id]) lastSessions[s.user_id] = s.started_at
      }
    }

    clients.value = assignments.map(a => {
      const p = a.profiles as any
      return {
        id: p.id,
        full_name: p.full_name,
        tier: p.tier,
        email: '',
        last_session_at: lastSessions[p.id] ?? null,
      }
    })
    loading.value = false
  }

  // ── Trainer: fetch workout plans ───────────────────────────────────────────
  async function fetchPlans() {
    const { data: plansData } = await supabase
      .from('workout_plans')
      .select('*, plan_day_templates(day_of_week, template_id, workout_templates(name))')
      .order('created_at', { ascending: false })

    plans.value = (plansData ?? []).map(p => ({
      id: p.id,
      trainer_id: p.trainer_id,
      name: p.name,
      description: p.description,
      created_at: p.created_at,
      updated_at: p.updated_at,
      days: (p.plan_day_templates ?? []).map((d: any) => ({
        day_of_week: d.day_of_week,
        template_id: d.template_id,
        template_name: d.workout_templates?.name ?? '',
      })).sort((a: PlanDay, b: PlanDay) => a.day_of_week - b.day_of_week),
    }))
  }

  // ── Trainer: create plan ───────────────────────────────────────────────────
  async function createPlan(name: string, description?: string): Promise<WorkoutPlan | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('workout_plans')
      .insert({ trainer_id: user.id, name, description: description ?? null })
      .select()
      .single()
    if (error || !data) return null
    const plan: WorkoutPlan = { ...data, days: [] }
    plans.value.unshift(plan)
    return plan
  }

  async function updatePlan(id: string, updates: { name?: string; description?: string }) {
    await supabase.from('workout_plans').update(updates).eq('id', id)
    const idx = plans.value.findIndex(p => p.id === id)
    if (idx !== -1) plans.value[idx] = { ...plans.value[idx], ...updates }
  }

  async function deletePlan(id: string) {
    await supabase.from('workout_plans').delete().eq('id', id)
    plans.value = plans.value.filter(p => p.id !== id)
  }

  // ── Trainer: set/clear a day on a plan ────────────────────────────────────
  async function setPlanDay(planId: string, dayOfWeek: number, templateId: string | null) {
    if (templateId === null) {
      await supabase.from('plan_day_templates')
        .delete()
        .eq('plan_id', planId)
        .eq('day_of_week', dayOfWeek)
      const plan = plans.value.find(p => p.id === planId)
      if (plan) plan.days = plan.days.filter(d => d.day_of_week !== dayOfWeek)
    } else {
      const { data: tmpl } = await supabase
        .from('workout_templates').select('name').eq('id', templateId).single()
      await supabase.from('plan_day_templates')
        .upsert({ plan_id: planId, day_of_week: dayOfWeek, template_id: templateId },
                 { onConflict: 'plan_id,day_of_week' })
      const plan = plans.value.find(p => p.id === planId)
      if (plan) {
        const existing = plan.days.find(d => d.day_of_week === dayOfWeek)
        if (existing) { existing.template_id = templateId; existing.template_name = tmpl?.name ?? '' }
        else plan.days.push({ day_of_week: dayOfWeek, template_id: templateId, template_name: tmpl?.name ?? '' })
        plan.days.sort((a, b) => a.day_of_week - b.day_of_week)
      }
    }
  }

  // ── Trainer: plan assignments ──────────────────────────────────────────────
  async function fetchClientAssignments(clientId: string): Promise<PlanAssignment[]> {
    const { data } = await supabase
      .from('client_plan_assignments')
      .select('*, workout_plans(name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    return (data ?? []).map(a => ({
      id: a.id,
      plan_id: a.plan_id,
      plan_name: (a.workout_plans as any)?.name ?? '',
      client_id: a.client_id,
      is_active: a.is_active,
      started_at: a.started_at,
    }))
  }

  async function assignPlan(planId: string, clientId: string): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { error } = await supabase.from('client_plan_assignments').upsert(
      { plan_id: planId, client_id: clientId, trainer_id: user.id, is_active: true },
      { onConflict: 'plan_id,client_id' }
    )
    return error?.message ?? null
  }

  async function deactivateAssignment(assignmentId: string) {
    await supabase.from('client_plan_assignments')
      .update({ is_active: false })
      .eq('id', assignmentId)
  }

  // ── Trainer: fetch client sessions ────────────────────────────────────────
  async function fetchClientSessions(clientId: string): Promise<ClientSession[]> {
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id, name, started_at, finished_at, duration_secs')
      .eq('user_id', clientId)
      .not('finished_at', 'is', null)
      .eq('deleted', false)
      .order('started_at', { ascending: false })
      .limit(30)

    if (!sessions?.length) return []

    const sessionIds = sessions.map(s => s.id)
    const { data: sets } = await supabase
      .from('sets')
      .select('session_id, weight_kg, reps')
      .in('session_id', sessionIds)

    const { data: feedback } = await supabase
      .from('session_feedback')
      .select('id, session_id, content')
      .in('session_id', sessionIds)

    const setsMap: Record<string, { count: number; vol: number }> = {}
    for (const s of sets ?? []) {
      if (!setsMap[s.session_id]) setsMap[s.session_id] = { count: 0, vol: 0 }
      setsMap[s.session_id].count++
      setsMap[s.session_id].vol += (s.weight_kg ?? 0) * (s.reps ?? 0)
    }
    const fbMap: Record<string, { id: string; content: string }> = {}
    for (const f of feedback ?? []) fbMap[f.session_id] = { id: f.id, content: f.content }

    return sessions.map(s => ({
      id: s.id,
      name: s.name,
      started_at: s.started_at,
      finished_at: s.finished_at,
      duration_secs: s.duration_secs,
      total_sets: setsMap[s.id]?.count ?? 0,
      total_volume: setsMap[s.id]?.vol ?? 0,
      feedback: fbMap[s.id]?.content ?? null,
      feedback_id: fbMap[s.id]?.id ?? null,
    }))
  }

  // ── Trainer: session feedback ──────────────────────────────────────────────
  async function saveFeedback(sessionId: string, content: string): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Not authenticated'
    const { error } = await supabase.from('session_feedback').upsert(
      { session_id: sessionId, trainer_id: user.id, content },
      { onConflict: 'session_id,trainer_id' }
    )
    return error?.message ?? null
  }

  async function deleteFeedback(feedbackId: string) {
    await supabase.from('session_feedback').delete().eq('id', feedbackId)
  }

  // ── Client: fetch today's plan template ───────────────────────────────────
  async function fetchTodayTemplate() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const dow = new Date().getDay() // 0=Sun
    const { data } = await supabase
      .from('client_plan_assignments')
      .select(`
        plan_id,
        workout_plans(name, plan_day_templates(day_of_week, template_id, workout_templates(name)))
      `)
      .eq('client_id', user.id)
      .eq('is_active', true)

    if (!data?.length) { todayTemplate.value = null; return }

    for (const a of data) {
      const plan = a.workout_plans as any
      const dayEntry = plan?.plan_day_templates?.find((d: any) => d.day_of_week === dow)
      if (dayEntry) {
        todayTemplate.value = {
          plan_id: a.plan_id,
          plan_name: plan.name,
          template_id: dayEntry.template_id,
          template_name: dayEntry.workout_templates?.name ?? '',
          day_of_week: dow,
        }
        return
      }
    }
    todayTemplate.value = null
  }

  // ── Client: fetch feedback for own session ─────────────────────────────────
  async function fetchSessionFeedback(sessionId: string): Promise<{ id: string; content: string; trainer_id: string } | null> {
    const { data } = await supabase
      .from('session_feedback')
      .select('id, content, trainer_id')
      .eq('session_id', sessionId)
      .maybeSingle()
    return data ?? null
  }

  return {
    clients, plans, todayTemplate, loading,
    fetchClients, fetchPlans,
    createPlan, updatePlan, deletePlan, setPlanDay,
    fetchClientAssignments, assignPlan, deactivateAssignment,
    fetchClientSessions,
    saveFeedback, deleteFeedback,
    fetchTodayTemplate, fetchSessionFeedback,
  }
})
