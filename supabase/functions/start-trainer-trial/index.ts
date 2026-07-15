/**
 * start-trainer-trial — Supabase Edge Function
 *
 * Called once, right after a self-serve signup on the admin portal, to turn a
 * brand-new role='user' account into a standalone (gym-less) trainer with a
 * 14-day free trial. Must run with the service role — RLS on `profiles`
 * explicitly blocks a user from setting their own `role` or
 * `trainer_subscription_status` (see migration 20260707000000).
 *
 * Deploy:  supabase functions deploy start-trainer-trial
 *
 * POST /functions/v1/start-trainer-trial
 * Headers: Authorization: Bearer <user-jwt>
 * Body:    {}
 * Returns: { ok: true, trial_ends_at: string }
 *
 * Only proceeds if the caller's own profile is currently role='user',
 * gym_id IS NULL, and trainer_subscription_status IS NULL — this makes the
 * trial a one-time grant: a gym-affiliated user can't get a second, free
 * standalone-trainer identity, and calling this twice can't reset the clock.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TRIAL_DAYS = 14

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405)
  }

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

  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .select('role, gym_id, trainer_subscription_status')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) return jsonError('Profile not found', 404)

  if (profile.role !== 'user' || profile.gym_id !== null || profile.trainer_subscription_status !== null) {
    return jsonError('Not eligible for a standalone trainer trial', 409)
  }

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

  const { error: updateErr } = await adminClient
    .from('profiles')
    .update({
      role: 'trainer',
      trainer_subscription_status: 'trialing',
      trainer_trial_ends_at: trialEndsAt.toISOString(),
    })
    .eq('id', user.id)

  if (updateErr) return jsonError(updateErr.message, 500)

  return new Response(JSON.stringify({ ok: true, trial_ends_at: trialEndsAt.toISOString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
})

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
