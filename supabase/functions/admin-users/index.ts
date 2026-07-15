/**
 * admin-users — Supabase Edge Function
 *
 * Replaces the browser's direct use of the service-role client for two
 * GoTrue admin-API calls that have no other way to run client-side:
 * listing auth users (id/email/created_at/last_sign_in_at) and deleting one.
 * Runs with the service role server-side only — the key never ships to
 * the browser.
 *
 * POST /functions/v1/admin-users
 * Headers: Authorization: Bearer <user-jwt>
 * Body:    { action: 'list' }
 *        | { action: 'delete', user_id: string }
 *
 * Caller must be role 'admin' or 'owner'. An 'admin' only sees/deletes
 * users in their own gym; an 'owner' has no gym restriction.
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
  try { body = await req.json() } catch { /* empty body is fine for 'list' */ }

  if (body.action === 'list') {
    const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    if (error) return jsonError(error.message, 500)

    let users = (data?.users ?? []).map(u => ({
      id:              u.id,
      email:           u.email ?? '',
      created_at:      u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }))

    if (callerProfile.role === 'admin') {
      const { data: gymProfiles } = await adminClient
        .from('profiles')
        .select('id')
        .eq('gym_id', callerProfile.gym_id)
      const allowedIds = new Set((gymProfiles ?? []).map(p => p.id))
      users = users.filter(u => allowedIds.has(u.id))
    }

    return jsonOk({ users })
  }

  if (body.action === 'delete') {
    const targetId = body.user_id as string | undefined
    if (!targetId) return jsonError('user_id is required', 400)

    if (callerProfile.role === 'admin') {
      const { data: target } = await adminClient
        .from('profiles')
        .select('gym_id')
        .eq('id', targetId)
        .single()
      if (!target || target.gym_id !== callerProfile.gym_id) return jsonError('Forbidden', 403)
    }

    const { error } = await adminClient.auth.admin.deleteUser(targetId)
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
