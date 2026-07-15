/**
 * admin-client-detail — Supabase Edge Function
 *
 * Backs the admin portal's /clients/:id page. Replaces six direct
 * service-role table/auth-admin calls the browser used to make itself.
 *
 * POST /functions/v1/admin-client-detail
 * Headers: Authorization: Bearer <user-jwt>
 * Body:    { user_id: string }
 *
 * Caller must be role 'admin' or 'owner'. An 'admin' may only view clients
 * in their own gym.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  const uid = body.user_id as string | undefined
  if (!uid) return jsonError('user_id is required', 400)

  const [profileRes, authRes] = await Promise.all([
    adminClient.from('profiles').select('*').eq('id', uid).single(),
    adminClient.auth.admin.getUserById(uid),
  ])

  if (!profileRes.data) return jsonError('Client not found', 404)
  if (callerProfile.role === 'admin' && profileRes.data.gym_id !== callerProfile.gym_id) {
    return jsonError('Forbidden', 403)
  }

  const [sessRes, measRes] = await Promise.all([
    adminClient.from('workout_sessions')
      .select('id, name, started_at, finished_at')
      .eq('user_id', uid).not('finished_at', 'is', null)
      .order('started_at', { ascending: false }).limit(100),
    adminClient.from('body_measurements').select('*').eq('user_id', uid)
      .order('measured_at', { ascending: false }).limit(20),
  ])

  const sessions = sessRes.data ?? []
  const measurements = measRes.data ?? []

  let sets: any[] = []
  const exerciseNames: Record<string, string> = {}
  const sessionIds = sessions.map(s => s.id)
  if (sessionIds.length) {
    const { data: setsData } = await adminClient.from('sets')
      .select('id, session_id, exercise_id, set_type, weight_kg, reps')
      .in('session_id', sessionIds)
    sets = setsData ?? []

    const exIds = [...new Set(sets.map(s => s.exercise_id))]
    if (exIds.length) {
      const { data: exData } = await adminClient.from('exercises').select('id, name').in('id', exIds)
      for (const e of exData ?? []) exerciseNames[e.id] = e.name
    }
  }

  return jsonOk({
    profile: profileRes.data,
    email: authRes.data.user?.email ?? '',
    sessions,
    measurements,
    sets,
    exercise_names: exerciseNames,
  })
})

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
