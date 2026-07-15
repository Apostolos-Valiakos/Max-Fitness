/**
 * accept-invite — Supabase Edge Function
 *
 * Accepts a gym invite for the currently authenticated user: sets their
 * gym_id + role (a user can't grant themselves these via RLS) and marks the
 * invite as accepted. Runs with the service role server-side only.
 *
 * POST /functions/v1/accept-invite
 * Headers: Authorization: Bearer <user-jwt>
 * Body:    { token: string }
 *
 * Tightened vs. the old client-side version: verifies the invite's email
 * matches the caller's own account email, so a logged-in user can't accept
 * an invite that was never addressed to them just by knowing/guessing its
 * token.
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

  let body: any = {}
  try { body = await req.json() } catch { /* */ }
  const token = body.token as string | undefined
  if (!token) return jsonError('token is required', 400)

  const adminClient = createClient(supabaseUrl, serviceKey)

  const { data: invite, error: inviteErr } = await adminClient
    .from('gym_invites')
    .select('id, gym_id, email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (inviteErr || !invite) return jsonError('Invite not found', 404)
  if (invite.accepted_at) return jsonError('This invite has already been accepted', 409)
  if (new Date(invite.expires_at) < new Date()) return jsonError('This invite has expired', 409)
  if (invite.email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return jsonError('This invite was sent to a different email address', 403)
  }

  if (invite.role === 'trainer') {
    const { data: gym } = await adminClient
      .from('gyms')
      .select('max_trainers')
      .eq('id', invite.gym_id)
      .single()
    const { count } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', invite.gym_id)
      .eq('role', 'trainer')
    if (gym && (count ?? 0) >= gym.max_trainers) {
      return jsonError('This gym has reached its trainer limit. Ask the admin to upgrade their plan.', 409)
    }
  }

  const { error: profErr } = await adminClient
    .from('profiles')
    .update({ gym_id: invite.gym_id, role: invite.role })
    .eq('id', user.id)

  if (profErr) return jsonError(profErr.message, 500)

  await adminClient
    .from('gym_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  return jsonOk({ ok: true, role: invite.role })
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
