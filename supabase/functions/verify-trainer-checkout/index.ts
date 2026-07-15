/**
 * verify-trainer-checkout — Supabase Edge Function
 *
 * Called after Stripe redirects back with ?session_id=cs_... from
 * create-trainer-checkout. Confirms payment and immediately sets
 * profiles.trainer_subscription_status = 'active' — no dependency on
 * webhook delivery timing. role stays 'trainer' (already set at trial start).
 *
 * Deploy:  supabase functions deploy verify-trainer-checkout
 * Secrets required:
 *   STRIPE_SECRET_KEY — same key used in create-trainer-checkout
 *
 * POST /functions/v1/verify-trainer-checkout
 * Headers: Authorization: Bearer <user-jwt>
 * Body:    { session_id: string }
 * Returns: { trainer_subscription_status: 'trialing' | 'active' }
 */

import Stripe from 'npm:stripe'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405)
  }

  const stripeKey   = Deno.env.get('STRIPE_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

  if (!stripeKey) return jsonError('STRIPE_SECRET_KEY not set', 500)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonError('Unauthorized', 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return jsonError('Unauthorized', 401)

  const { session_id } = await req.json().catch(() => ({}))
  if (!session_id) return jsonError('session_id is required', 400)

  const stripe      = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
  const adminClient = createClient(supabaseUrl, serviceKey)

  let checkoutSession: Stripe.Checkout.Session
  try {
    checkoutSession = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription'],
    })
  } catch (err: any) {
    return jsonError(`Stripe error: ${err.message}`, 400)
  }

  if (checkoutSession.metadata?.type !== 'trainer' || checkoutSession.metadata?.user_id !== user.id) {
    return jsonError('Forbidden', 403)
  }

  const { data: current } = await adminClient
    .from('profiles')
    .select('trainer_subscription_status')
    .eq('id', user.id)
    .single()

  if (checkoutSession.payment_status !== 'paid') {
    return new Response(JSON.stringify({ trainer_subscription_status: current?.trainer_subscription_status ?? 'trialing' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }

  const customerId = checkoutSession.customer as string | null
  const update: Record<string, string> = { trainer_subscription_status: 'active' }
  if (customerId) update.stripe_customer_id = customerId

  const { error: updateErr } = await adminClient
    .from('profiles')
    .update(update)
    .eq('id', user.id)

  if (updateErr) {
    console.error('Failed to update profile:', updateErr)
    return jsonError('Failed to update subscription status', 500)
  }

  return new Response(JSON.stringify({ trainer_subscription_status: 'active' }), {
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
