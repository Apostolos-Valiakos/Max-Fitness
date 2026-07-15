/**
 * stripe-webhook — Supabase Edge Function
 *
 * Handles Stripe billing events for gym subscriptions, individual mobile user
 * tier upgrades (free/paid/ultra), and standalone trainer subscriptions.
 *
 * Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
 * Secrets to set:
 *   STRIPE_SECRET_KEY        — sk_live_... (or sk_test_... for dev)
 *   STRIPE_WEBHOOK_SECRET    — whsec_...  (from Stripe Dashboard → Webhooks)
 *   STRIPE_PRICE_USER_PAID   — price_... for Paid user tier
 *   STRIPE_PRICE_USER_ULTRA  — price_... for Ultra user tier
 *   STRIPE_PRICE_TRAINER     — price_... for the standalone trainer plan
 *
 * Events to enable in Stripe Dashboard:
 *   checkout.session.completed
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.payment_succeeded
 *   invoice.payment_failed
 */

import Stripe from 'npm:stripe'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_STATUS_MAP: Record<string, string> = {
  active:             'active',
  trialing:           'trialing',
  past_due:           'past_due',
  canceled:           'canceled',
  unpaid:             'past_due',
  incomplete:         'past_due',
  incomplete_expired: 'canceled',
  paused:             'suspended',
}

Deno.serve(async (req) => {
  const stripeKey     = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!stripeKey || !webhookSecret) {
    console.error('Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET')
    return new Response('Server misconfiguration', { status: 500 })
  }

  const stripe   = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error('Stripe signature error:', err.message)
    return new Response(`Webhook verification failed: ${err.message}`, { status: 400 })
  }

  try {
    switch (event.type) {

      // ── Checkout completed ─────────────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        if (session.metadata?.type === 'user' || session.metadata?.type === 'trainer') {
          // Store customer ID on the profile so the portal can use it
          const userId     = session.metadata?.user_id
          const customerId = session.customer as string
          if (userId) {
            await supabase.from('profiles')
              .update({ stripe_customer_id: customerId })
              .eq('id', userId)
          }
        } else {
          // Gym checkout
          const gymId = session.metadata?.gym_id
          if (!gymId) { console.warn('checkout.session.completed: no gym_id in metadata'); break }

          const customerId     = session.customer as string
          const subscriptionId = session.subscription as string
          const sub = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ['items.data.price.product'],
          })
          await upsertGymSubscription(supabase, gymId, customerId, sub)
        }
        break
      }

      // ── Subscription created / updated ────────────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription

        if (sub.metadata?.type === 'user') {
          await handleUserSubscription(supabase, sub)
        } else if (sub.metadata?.type === 'trainer') {
          await handleTrainerSubscription(supabase, sub)
        } else {
          const gymId = await gymIdByCustomer(supabase, sub.customer as string)
          if (!gymId) break
          await upsertGymSubscription(supabase, gymId, sub.customer as string, sub)
        }
        break
      }

      // ── Subscription deleted (canceled) ───────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription

        if (sub.metadata?.type === 'user') {
          const userId = sub.metadata?.user_id
          if (userId) {
            await supabase.from('profiles').update({ tier: 'free' }).eq('id', userId)
          }
        } else if (sub.metadata?.type === 'trainer') {
          const userId = sub.metadata?.user_id
          if (userId) {
            await supabase.from('profiles').update({ trainer_subscription_status: 'canceled' }).eq('id', userId)
          }
        } else {
          const gymId = await gymIdByCustomer(supabase, sub.customer as string)
          if (!gymId) break
          await supabase.from('gym_subscriptions').upsert({
            gym_id:                 gymId,
            stripe_customer_id:     sub.customer as string,
            stripe_subscription_id: sub.id,
            status:                 'canceled',
            cancel_at_period_end:   true,
            updated_at:             new Date().toISOString(),
          }, { onConflict: 'gym_id' })
          await supabase.from('gyms')
            .update({ subscription_status: 'canceled', updated_at: new Date().toISOString() })
            .eq('id', gymId)
        }
        break
      }

      // ── Payment succeeded ─────────────────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break

        const customerId = invoice.customer as string
        const gymId = await gymIdByCustomer(supabase, customerId)

        if (gymId) {
          await supabase.from('gym_subscriptions')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('gym_id', gymId)
          await supabase.from('gyms')
            .update({ subscription_status: 'active', updated_at: new Date().toISOString() })
            .eq('id', gymId)
        } else {
          // Could be a user or trainer subscription renewal — re-fetch sub for metadata
          const subId = invoice.subscription as string
          const sub = await stripe.subscriptions.retrieve(subId)
          if (sub.metadata?.type === 'user') {
            await handleUserSubscription(supabase, sub)
          } else if (sub.metadata?.type === 'trainer') {
            await handleTrainerSubscription(supabase, sub)
          }
        }
        break
      }

      // ── Payment failed ────────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break

        const customerId = invoice.customer as string
        const gymId = await gymIdByCustomer(supabase, customerId)

        if (gymId) {
          await supabase.from('gym_subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('gym_id', gymId)
          await supabase.from('gyms')
            .update({ subscription_status: 'past_due', updated_at: new Date().toISOString() })
            .eq('id', gymId)
        } else {
          // User/trainer subscription payment failed
          const subId = invoice.subscription as string
          const sub = await stripe.subscriptions.retrieve(subId)
          if (sub.metadata?.type === 'user') {
            const userId = sub.metadata?.user_id
            if (userId) {
              await supabase.from('profiles').update({ tier: 'free' }).eq('id', userId)
            }
          } else if (sub.metadata?.type === 'trainer') {
            const userId = sub.metadata?.user_id
            if (userId) {
              await supabase.from('profiles').update({ trainer_subscription_status: 'past_due' }).eq('id', userId)
            }
          }
        }
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }
  } catch (err: any) {
    console.error('Handler error:', err)
    return new Response(`Handler error: ${err.message}`, { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── Helpers ────────────────────────────────────────────────────────────────

async function gymIdByCustomer(supabase: any, customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('gym_subscriptions')
    .select('gym_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return data?.gym_id ?? null
}

async function handleUserSubscription(supabase: any, sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id
  if (!userId) return

  const paidPriceId  = Deno.env.get('STRIPE_PRICE_USER_PAID')
  const ultraPriceId = Deno.env.get('STRIPE_PRICE_USER_ULTRA')
  const priceId      = sub.items.data[0]?.price.id

  let tier = 'free'
  if (sub.status === 'active' || sub.status === 'trialing') {
    if (priceId === ultraPriceId)     tier = 'ultra'
    else if (priceId === paidPriceId) tier = 'paid'
  }

  await supabase.from('profiles').update({ tier }).eq('id', userId)
}

async function handleTrainerSubscription(supabase: any, sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id
  if (!userId) return

  // profiles.trainer_subscription_status only allows trialing/active/past_due/canceled
  // (no 'suspended') — collapse anything else Stripe reports into 'canceled'.
  const status = STRIPE_STATUS_MAP[sub.status] ?? sub.status
  const trainerStatus = ['trialing', 'active', 'past_due', 'canceled'].includes(status) ? status : 'canceled'

  await supabase.from('profiles').update({ trainer_subscription_status: trainerStatus }).eq('id', userId)
}

async function upsertGymSubscription(
  supabase: any,
  gymId: string,
  customerId: string,
  sub: Stripe.Subscription,
) {
  const item        = sub.items.data[0]
  const priceId     = item?.price.id ?? null
  const product     = item?.price.product as Stripe.Product | null
  const planName    = (product?.metadata?.plan ?? 'basic') as string
  const amountCents = item?.price.unit_amount ?? 0
  const gymStatus   = STRIPE_STATUS_MAP[sub.status] ?? sub.status

  await supabase.from('gym_subscriptions').upsert({
    gym_id:                 gymId,
    stripe_customer_id:     customerId,
    stripe_subscription_id: sub.id,
    stripe_price_id:        priceId,
    plan:                   planName,
    status:                 sub.status,
    current_period_start:   new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end:     new Date(sub.current_period_end   * 1000).toISOString(),
    cancel_at_period_end:   sub.cancel_at_period_end,
    monthly_amount_cents:   amountCents,
    updated_at:             new Date().toISOString(),
  }, { onConflict: 'gym_id' })

  await supabase.from('gyms').update({
    plan:                planName,
    subscription_status: gymStatus,
    updated_at:          new Date().toISOString(),
  }).eq('id', gymId)
}
