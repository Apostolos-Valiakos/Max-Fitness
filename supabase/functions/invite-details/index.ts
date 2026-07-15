/**
 * invite-details — Supabase Edge Function
 *
 * Looks up a gym invite by its token for the public /invite/:token page —
 * this runs before the visitor has necessarily signed up or logged in, so
 * unlike every other admin-* function here it takes NO Authorization header.
 * Access control is the token itself: a random, hard-to-guess value, the
 * same trust model as a password-reset link.
 *
 * POST /functions/v1/invite-details
 * Body: { token: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })
  if (req.method !== 'POST') return jsonError('Method not allowed', 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const adminClient = createClient(supabaseUrl, serviceKey)

  let body: any = {}
  try { body = await req.json() } catch { /* */ }
  const token = body.token as string | undefined
  if (!token) return jsonError('token is required', 400)

  const { data, error } = await adminClient
    .from('gym_invites')
    .select('id, gym_id, email, role, token, expires_at, accepted_at, gyms(name)')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) return jsonError('Invite not found', 404)

  return jsonOk({ invite: data })
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
