/**
 * create-user-checkout — Supabase Edge Function
 *
 * Creates a Stripe Checkout session for a mobile user's tier upgrade (free → paid/ultra).
 *
 * Deploy:  supabase functions deploy create-user-checkout
 * Secrets required:
 *   STRIPE_SECRET_KEY        — sk_live_... (or sk_test_... for dev)
 *   STRIPE_PRICE_USER_PAID   — price_... for Paid tier
 *   STRIPE_PRICE_USER_ULTRA  — price_... for Ultra tier
 *
 * POST /functions/v1/create-user-checkout
 * Headers: Authorization: Bearer <user-jwt>
 * Body:    { tier: 'paid'|'ultra', success_url?: string, cancel_url?: string }
 * Returns: { url: string }
 */

import Stripe from 'npm:stripe'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() })
  }

  const stripeKey   = Deno.env.get('STRIPE_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!
  const siteUrl     = Deno.env.get('SITE_URL') ?? 'http://localhost:5174'

  if (!stripeKey) return jsonError('STRIPE_SECRET_KEY not set', 500)

  const PRICE_IDS: Record<string, string | undefined> = {
    paid:  Deno.env.get('STRIPE_PRICE_USER_PAID'),
    ultra: Deno.env.get('STRIPE_PRICE_USER_ULTRA'),
  }

  // Authenticate caller
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonError('Unauthorized', 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return jsonError('Unauthorized', 401)

  const { tier, success_url, cancel_url } = await req.json()

  if (!['paid', 'ultra'].includes(tier)) {
    return jsonError('Invalid tier. Must be "paid" or "ultra".', 400)
  }

  const priceId = PRICE_IDS[tier]
  if (!priceId) {
    return jsonError(
      `Price not configured for tier "${tier}". Set STRIPE_PRICE_USER_${tier.toUpperCase()}.`,
      400,
    )
  }

  const stripe      = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
  const adminClient = createClient(supabaseUrl, serviceKey)

  // Get or create Stripe customer for this user
  const { data: profile } = await adminClient
    .from('profiles')
    .select('stripe_customer_id, full_name')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id as string | undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    user.email,
      name:     profile?.full_name ?? user.email,
      metadata: { user_id: user.id },
    })
    customerId = customer.id
    await adminClient.from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  // Append {CHECKOUT_SESSION_ID} so the verify function can confirm payment on return
  const baseSuccess = success_url ?? `${siteUrl}/profile?upgraded=1`
  const fullSuccess = baseSuccess.includes('?')
    ? `${baseSuccess}&session_id={CHECKOUT_SESSION_ID}`
    : `${baseSuccess}?session_id={CHECKOUT_SESSION_ID}`

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    payment_method_types: ['card'],
    line_items:           [{ price: priceId, quantity: 1 }],
    mode:                 'subscription',
    metadata:             { type: 'user', user_id: user.id },
    success_url:          fullSuccess,
    cancel_url:           cancel_url ?? `${siteUrl}/profile`,
    subscription_data:    { metadata: { type: 'user', user_id: user.id } },
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
