/**
 * create-portal — Supabase Edge Function
 *
 * Creates a Stripe Customer Portal session so gym admins can manage
 * their subscription (upgrade, downgrade, cancel, update payment).
 *
 * Deploy:  supabase functions deploy create-portal
 * Requires: STRIPE_SECRET_KEY, SITE_URL secrets
 *
 * POST /functions/v1/create-portal
 * Headers: Authorization: Bearer <user-jwt>
 * Body:    { gym_id: string, return_url?: string }
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

  if (!stripeKey) return jsonError('STRIPE_SECRET_KEY not set', 500)

  // Authenticate
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonError('Unauthorized', 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return jsonError('Unauthorized', 401)

  const adminClient = createClient(supabaseUrl, serviceKey)
  const { data: profile } = await adminClient
    .from('profiles').select('role, gym_id').eq('id', user.id).single()

  if (!profile || !['admin', 'owner'].includes(profile.role)) {
    return jsonError('Forbidden', 403)
  }

  const body = await req.json()
  const { gym_id, return_url } = body

  if (profile.role === 'admin' && profile.gym_id !== gym_id) {
    return jsonError('Forbidden: wrong gym', 403)
  }

  // Get Stripe customer for the gym
  const { data: sub } = await adminClient
    .from('gym_subscriptions').select('stripe_customer_id').eq('gym_id', gym_id).maybeSingle()

  if (!sub?.stripe_customer_id) {
    return jsonError('No Stripe customer found for this gym. Subscribe first.', 400)
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   sub.stripe_customer_id,
    return_url: return_url ?? `${siteUrl}/billing`,
  })

  return new Response(JSON.stringify({ url: portalSession.url }), {
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
