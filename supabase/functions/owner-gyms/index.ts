/**
 * owner-gyms — Supabase Edge Function
 *
 * Backs both owner-portal pages that need cross-gym visibility: /owner/gyms
 * (list, create, suspend/activate) and /owner/revenue (list only). Runs with
 * the service role server-side only — this data spans every tenant, so it
 * can never be RLS-scoped to a single caller the way regular admin queries are.
 *
 * POST /functions/v1/owner-gyms
 * Headers: Authorization: Bearer <user-jwt>
 * Body:    { action: 'list' }
 *        | { action: 'create', name, slug, join_code, plan, admin_email }
 *        | { action: 'set_status', gym_id, status }
 *
 * Caller must be role 'owner'.
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
    .select('role')
    .eq('id', user.id)
    .single()

  if (!callerProfile || callerProfile.role !== 'owner') return jsonError('Forbidden', 403)

  let body: any = {}
  try { body = await req.json() } catch { /* */ }

  if (body.action === 'list') {
    const [gymsRes, profilesRes] = await Promise.all([
      adminClient.from('gyms').select('*').order('created_at', { ascending: false }),
      adminClient.from('profiles').select('gym_id, role').not('gym_id', 'is', null),
    ])

    const gyms = gymsRes.data ?? []
    const counts: Record<string, { total: number; trainers: number; clients: number }> = {}
    for (const p of profilesRes.data ?? []) {
      const gid = p.gym_id as string
      if (!counts[gid]) counts[gid] = { total: 0, trainers: 0, clients: 0 }
      counts[gid].total++
      if (p.role === 'trainer') counts[gid].trainers++
      else if (p.role === 'user') counts[gid].clients++
    }

    return jsonOk({ gyms, counts })
  }

  if (body.action === 'create') {
    const { name, slug, join_code, plan, admin_email } = body
    if (!name || !slug || !join_code || !plan || !admin_email) {
      return jsonError('name, slug, join_code, plan, and admin_email are required', 400)
    }

    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)

    const { data: gym, error: gymErr } = await adminClient.from('gyms').insert({
      name, slug,
      join_code:           String(join_code).toUpperCase(),
      plan,
      created_by:          user.id,
      subscription_status: 'trialing',
      trial_ends_at:       trialEnd.toISOString(),
    }).select('id').single()

    if (gymErr) return jsonError(gymErr.message, 500)

    const { data: invite, error: inviteErr } = await adminClient
      .from('gym_invites')
      .insert({
        gym_id:     gym.id,
        email:      String(admin_email).trim().toLowerCase(),
        role:       'admin',
        invited_by: user.id,
      })
      .select('id, token')
      .single()

    if (inviteErr) return jsonOk({ gym_id: gym.id, invite: null, invite_error: inviteErr.message })

    return jsonOk({ gym_id: gym.id, invite })
  }

  if (body.action === 'set_status') {
    const { gym_id, status } = body
    if (!gym_id || !status) return jsonError('gym_id and status are required', 400)

    const { error } = await adminClient.from('gyms').update({ subscription_status: status }).eq('id', gym_id)
    if (error) return jsonError(error.message, 500)
    return jsonOk({ ok: true })
  }

  return jsonError('Unknown action', 400)
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
