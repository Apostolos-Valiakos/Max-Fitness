/**
 * create-checkout — Supabase Edge Function
 *
 * Creates a Stripe Checkout session for a gym subscription.
 *
 * Deploy:  supabase functions deploy create-checkout
 * Secrets to set (in addition to STRIPE_SECRET_KEY):
 *   STRIPE_PRICE_BASIC   — price_... from Stripe Dashboard
 *   STRIPE_PRICE_PRO     — price_...
 *   STRIPE_PRICE_ELITE   — price_...
 *   SITE_URL             — https://admin.yourapp.com (for redirect URLs)
 *
 * POST /functions/v1/create-checkout
 * Headers: Authorization: Bearer <user-jwt>
 * Body:   { gym_id: string, plan: 'basic'|'pro'|'elite', success_url?: string, cancel_url?: string }
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
  const siteUrl     = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'

  if (!stripeKey) {
    return jsonError('STRIPE_SECRET_KEY not set', 500)
  }

  const PRICE_IDS: Record<string, string | undefined> = {
    basic:  Deno.env.get('STRIPE_PRICE_BASIC'),
    pro:    Deno.env.get('STRIPE_PRICE_PRO'),
    elite:  Deno.env.get('STRIPE_PRICE_ELITE'),
  }

  // Authenticate the caller
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonError('Unauthorized', 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return jsonError('Unauthorized', 401)

  // Fetch profile to confirm role
  const adminClient = createClient(supabaseUrl, serviceKey)
  const { data: profile } = await adminClient
    .from('profiles').select('role, gym_id').eq('id', user.id).single()

  if (!profile || !['admin', 'owner'].includes(profile.role)) {
    return jsonError('Forbidden', 403)
  }

  const body = await req.json()
  const { gym_id, plan, success_url, cancel_url } = body

  // Admins can only manage their own gym
  if (profile.role === 'admin' && profile.gym_id !== gym_id) {
    return jsonError('Forbidden: wrong gym', 403)
  }

  const priceId = PRICE_IDS[plan]
  if (!priceId) {
    return jsonError(`Price not configured for plan "${plan}". Set STRIPE_PRICE_${(plan as string).toUpperCase()}.`, 400)
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

  // Get or create Stripe customer for the gym
  const { data: existingSub } = await adminClient
    .from('gym_subscriptions').select('stripe_customer_id').eq('gym_id', gym_id).maybeSingle()

  let customerId = existingSub?.stripe_customer_id as string | undefined

  if (!customerId) {
    const { data: gym } = await adminClient.from('gyms').select('name, slug').eq('id', gym_id).single()
    const customer = await stripe.customers.create({
      name:     gym?.name ?? gym_id,
      metadata: { gym_id, gym_slug: gym?.slug ?? '' },
    })
    customerId = customer.id

    // Pre-create the row so the webhook can look up gym_id by customer_id
    await adminClient.from('gym_subscriptions').upsert({
      gym_id,
      stripe_customer_id: customerId,
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'gym_id' })
  }

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    payment_method_types: ['card'],
    line_items:           [{ price: priceId, quantity: 1 }],
    mode:                 'subscription',
    metadata:             { gym_id },
    success_url:          success_url ?? `${siteUrl}/billing?success=1`,
    cancel_url:           cancel_url  ?? `${siteUrl}/billing`,
    subscription_data:    { metadata: { gym_id } },
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
