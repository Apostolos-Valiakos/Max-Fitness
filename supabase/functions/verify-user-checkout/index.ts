/**
 * verify-user-checkout — Supabase Edge Function
 *
 * Called after Stripe redirects back to the app with ?session_id=cs_...
 * Retrieves the checkout session, confirms payment, and immediately updates
 * profiles.tier — no dependency on webhook delivery timing.
 *
 * Deploy:  supabase functions deploy verify-user-checkout
 * Secrets required:
 *   STRIPE_SECRET_KEY        — same key used in create-user-checkout
 *   STRIPE_PRICE_USER_PAID   — price_... for Paid tier
 *   STRIPE_PRICE_USER_ULTRA  — price_... for Ultra tier
 *
 * POST /functions/v1/verify-user-checkout
 * Headers: Authorization: Bearer <user-jwt>
 * Body:    { session_id: string }
 * Returns: { tier: 'free' | 'paid' | 'ultra' }
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

  if (!stripeKey) return jsonError('STRIPE_SECRET_KEY not set', 500)

  // Authenticate caller
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonError('Unauthorized', 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return jsonError('Unauthorized', 401)

  const { session_id } = await req.json()
  if (!session_id) return jsonError('session_id is required', 400)

  const stripe      = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
  const adminClient = createClient(supabaseUrl, serviceKey)

  // Retrieve the checkout session with subscription details
  let checkoutSession: Stripe.Checkout.Session
  try {
    checkoutSession = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription', 'subscription.items.data.price'],
    })
  } catch (err: any) {
    return jsonError(`Stripe error: ${err.message}`, 400)
  }

  // Verify this session belongs to the calling user
  const sessionUserId = checkoutSession.metadata?.user_id
  if (sessionUserId !== user.id) {
    return jsonError('Forbidden', 403)
  }

  // Payment must be confirmed
  if (checkoutSession.payment_status !== 'paid') {
    return new Response(JSON.stringify({ tier: 'free' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }

  // Map the Stripe price to a tier
  const paidPriceId  = Deno.env.get('STRIPE_PRICE_USER_PAID')
  const ultraPriceId = Deno.env.get('STRIPE_PRICE_USER_ULTRA')

  const sub    = checkoutSession.subscription as Stripe.Subscription | null
  const priceId = sub?.items?.data[0]?.price?.id ?? null

  let tier = 'paid' // Default to paid if price mapping is missing
  if (priceId === ultraPriceId)     tier = 'ultra'
  else if (priceId === paidPriceId) tier = 'paid'

  // Update tier + ensure stripe_customer_id is saved (column may not have existed
  // when the original checkout ran, so backfill it here)
  const customerId = checkoutSession.customer as string | null
  const profileUpdate: Record<string, string> = { tier }
  if (customerId) profileUpdate.stripe_customer_id = customerId

  const { error: updateErr } = await adminClient
    .from('profiles')
    .update(profileUpdate)
    .eq('id', user.id)

  if (updateErr) {
    console.error('Failed to update profile:', updateErr)
    return jsonError('Failed to update tier', 500)
  }

  return new Response(JSON.stringify({ tier }), {
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
