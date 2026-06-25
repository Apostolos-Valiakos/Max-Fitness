/**
 * create-user-portal — Supabase Edge Function
 *
 * Opens the Stripe Customer Portal for a mobile user to manage or cancel
 * their paid/ultra subscription.
 *
 * Deploy:  supabase functions deploy create-user-portal
 * Secrets required:  STRIPE_SECRET_KEY
 *
 * POST /functions/v1/create-user-portal
 * Headers: Authorization: Bearer <user-jwt>
 * Body:    { return_url?: string }
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
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return jsonError('No billing account found.', 404)
  }

  const { return_url } = await req.json().catch(() => ({}))
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   profile.stripe_customer_id,
    return_url: return_url ?? `${siteUrl}/profile`,
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
