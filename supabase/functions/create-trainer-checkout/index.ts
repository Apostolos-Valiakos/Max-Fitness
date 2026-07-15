/**
 * create-trainer-checkout — Supabase Edge Function
 *
 * Creates a Stripe Checkout session for a standalone trainer's subscription
 * (single flat plan — no tiers). Used once their 14-day self-serve trial has
 * ended, or any time they want to subscribe early.
 *
 * Deploy:  supabase functions deploy create-trainer-checkout
 * Secrets required:
 *   STRIPE_SECRET_KEY    — sk_live_... (or sk_test_... for dev)
 *   STRIPE_PRICE_TRAINER — price_... for the standalone trainer plan
 *
 * POST /functions/v1/create-trainer-checkout
 * Headers: Authorization: Bearer <user-jwt>
 * Body:    { success_url?: string, cancel_url?: string }
 * Returns: { url: string }
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
  const siteUrl     = Deno.env.get('SITE_URL') ?? 'http://localhost:5174'
  const priceId     = Deno.env.get('STRIPE_PRICE_TRAINER')

  if (!stripeKey) return jsonError('STRIPE_SECRET_KEY not set', 500)
  if (!priceId) return jsonError('STRIPE_PRICE_TRAINER not set', 500)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonError('Unauthorized', 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return jsonError('Unauthorized', 401)

  const { success_url, cancel_url } = await req.json().catch(() => ({}))

  const stripe      = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
  const adminClient = createClient(supabaseUrl, serviceKey)

  // Standalone trainers only — gym-affiliated trainers don't pay individually
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, gym_id, full_name, stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'trainer' || profile.gym_id !== null) {
    return jsonError('This checkout is only for standalone (gym-less) trainers', 403)
  }

  // Get or create Stripe customer (same column client-tier upgrades already use —
  // one customer can hold both a client-tier subscription and a trainer-plan one)
  let customerId = profile.stripe_customer_id as string | undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    user.email,
      name:     profile.full_name ?? user.email,
      metadata: { user_id: user.id },
    })
    customerId = customer.id
    await adminClient.from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const baseSuccess = success_url ?? `${siteUrl}/trainer/clients?upgraded=1`
  const fullSuccess = baseSuccess.includes('?')
    ? `${baseSuccess}&session_id={CHECKOUT_SESSION_ID}`
    : `${baseSuccess}?session_id={CHECKOUT_SESSION_ID}`

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    payment_method_types: ['card'],
    line_items:           [{ price: priceId, quantity: 1 }],
    mode:                 'subscription',
    metadata:             { type: 'trainer', user_id: user.id },
    success_url:          fullSuccess,
    cancel_url:           cancel_url ?? `${siteUrl}/trainer/clients`,
    subscription_data:    { metadata: { type: 'trainer', user_id: user.id } },
  })

  return new Response(JSON.stringify({ url: session.url }), {
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
