<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">BILLING</h1>
        <div class="page-sub">{{ gymStore.gym?.name }}</div>
      </div>
    </div>

    <div v-if="gymStore.loading" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading…</div>

    <template v-else-if="gymStore.gym">

      <!-- Current plan card -->
      <div class="plan-card card">
        <div class="plan-header">
          <div>
            <div class="plan-name">{{ gymStore.gym.plan.toUpperCase() }} PLAN</div>
            <div class="plan-price">
              €{{ planPrice(gymStore.gym.plan) }}<span class="plan-period">/mo</span>
            </div>
          </div>
          <span class="status-badge" :class="gymStore.gym.subscription_status">
            {{ gymStore.gym.subscription_status.replace('_', ' ').toUpperCase() }}
          </span>
        </div>

        <div v-if="gymStore.isTrialing" class="trial-warning">
          <i class="pi pi-clock" />
          Trial ends {{ trialDaysLeft }} — subscribe before then to keep access.
        </div>

        <div v-if="gymStore.subscription?.current_period_end && !gymStore.isTrialing" class="billing-meta">
          Next billing date: <strong>{{ fmtDate(gymStore.subscription.current_period_end) }}</strong>
          <span v-if="gymStore.subscription.cancel_at_period_end" class="cancel-notice">
            · Cancels at end of period
          </span>
        </div>
      </div>

      <!-- Usage -->
      <div class="card usage-card">
        <div class="section-title">USAGE</div>
        <div class="usage-row">
          <div class="usage-label">Trainers</div>
          <div class="usage-bar-wrap">
            <div class="usage-bar" :style="{ width: trainerPct + '%' }" :class="{ danger: trainerPct >= 90 }" />
          </div>
          <div class="usage-count">{{ gymStore.trainerCount }} / {{ gymStore.gym.max_trainers }}</div>
        </div>
        <div class="usage-row">
          <div class="usage-label">Clients</div>
          <div class="usage-bar-wrap">
            <div class="usage-bar" :style="{ width: clientPct + '%' }" :class="{ danger: clientPct >= 90 }" />
          </div>
          <div class="usage-count">{{ gymStore.clientCount }} / {{ gymStore.gym.max_clients }}</div>
        </div>
      </div>

      <!-- Subscribe / upgrade plans -->
      <template v-if="upgradePlans.length">
        <div class="section-title" style="margin-bottom:0.75rem">{{ gymStore.isTrialing ? 'CHOOSE A PLAN' : 'UPGRADE PLAN' }}</div>
        <div class="plans-row">
          <div v-for="p in upgradePlans" :key="p.id" class="plan-option card">
            <div class="po-name">{{ p.label }}</div>
            <div class="po-price">€{{ p.price }}<span class="po-period">/mo</span></div>
            <ul class="po-features">
              <li v-for="f in p.features" :key="f"><i class="pi pi-check" /> {{ f }}</li>
            </ul>
            <Button
              :label="gymStore.isTrialing ? ('Subscribe — ' + p.label) : ('Upgrade to ' + p.label)"
              class="po-btn"
              :loading="checkoutLoading === p.id"
              @click="startCheckout(p.id)"
            />
          </div>
        </div>
      </template>

      <!-- Manage billing (Stripe portal) -->
      <div v-if="gymStore.subscription?.status" class="card manage-card">
        <div class="manage-text">
          <div class="manage-title">Manage Billing</div>
          <div class="manage-sub">Update payment method, download invoices, or cancel your subscription.</div>
        </div>
        <Button
          label="Open Billing Portal"
          icon="pi pi-external-link"
          severity="secondary"
          outlined
          :loading="portalLoading"
          @click="openPortal"
        />
      </div>

    </template>

    <div v-else class="empty-state">
      <i class="pi pi-building empty-icon" />
      <p>No gym data found.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import { useGymStore } from '@/stores/gymStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { differenceInDays, format } from 'date-fns'

const toast    = useToast()
const gymStore = useGymStore()
const auth     = useAuthStore()

const checkoutLoading = ref<string | null>(null)
const portalLoading   = ref(false)

const PLAN_PRICES: Record<string, number> = { basic: 39, pro: 99, elite: 199 }
function planPrice(plan: string) { return PLAN_PRICES[plan] ?? 0 }

const PLANS = [
  {
    id: 'basic', label: 'Basic', price: 39,
    features: ['Up to 3 trainers', 'Up to 30 clients', 'Core features'],
  },
  {
    id: 'pro', label: 'Pro', price: 99,
    features: ['Up to 10 trainers', 'Up to 100 clients', 'Analytics', 'Priority support'],
  },
  {
    id: 'elite', label: 'Elite', price: 199,
    features: ['Unlimited trainers', 'Unlimited clients', 'All features', 'Dedicated support'],
  },
]

const PLAN_ORDER = ['basic', 'pro', 'elite']

const upgradePlans = computed(() => {
  // During trial show all plans (not yet subscribed to any)
  if (gymStore.isTrialing) return PLANS
  const currentIdx = PLAN_ORDER.indexOf(gymStore.gym?.plan ?? 'basic')
  return PLANS.filter((_, i) => i > currentIdx)
})

const trainerPct = computed(() => {
  if (!gymStore.gym || gymStore.gym.max_trainers >= 9999) return 0
  return Math.min(100, Math.round(gymStore.trainerCount / gymStore.gym.max_trainers * 100))
})
const clientPct = computed(() => {
  if (!gymStore.gym || gymStore.gym.max_clients >= 9999) return 0
  return Math.min(100, Math.round(gymStore.clientCount / gymStore.gym.max_clients * 100))
})

const trialDaysLeft = computed(() => {
  if (!gymStore.gym?.trial_ends_at) return '—'
  const days = differenceInDays(new Date(gymStore.gym.trial_ends_at), new Date())
  if (days <= 0) return 'today'
  return `in ${days} day${days !== 1 ? 's' : ''}`
})

function fmtDate(iso: string) { return format(new Date(iso), 'MMM d, yyyy') }

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session ? `Bearer ${session.access_token}` : null
}

async function startCheckout(plan: string) {
  if (!gymStore.gym) return
  checkoutLoading.value = plan

  const authHeader = await getAuthHeader()
  if (!authHeader) { checkoutLoading.value = null; return }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body:    JSON.stringify({
        gym_id:      gymStore.gym.id,
        plan,
        success_url: `${window.location.origin}/billing?success=1`,
        cancel_url:  `${window.location.origin}/billing`,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      toast.add({ severity: 'error', summary: 'Error', detail: json.error ?? 'Checkout failed', life: 4000 })
      return
    }
    window.location.href = json.url
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.message, life: 4000 })
  } finally {
    checkoutLoading.value = null
  }
}

async function openPortal() {
  if (!gymStore.gym) return
  portalLoading.value = true

  const authHeader = await getAuthHeader()
  if (!authHeader) { portalLoading.value = false; return }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/create-portal`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body:    JSON.stringify({
        gym_id:     gymStore.gym.id,
        return_url: `${window.location.origin}/billing`,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      toast.add({ severity: 'error', summary: 'Error', detail: json.error ?? 'Could not open billing portal', life: 4000 })
      return
    }
    window.location.href = json.url
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.message, life: 4000 })
  } finally {
    portalLoading.value = false
  }
}
</script>

<style scoped>
/* Current plan card */
.plan-card { padding: 1.5rem; margin-bottom: 1rem; }
.plan-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
.plan-name   { font-family: 'Barlow Condensed', sans-serif; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.15em; color: var(--muted); margin-bottom: 0.25rem; }
.plan-price  { font-family: 'Barlow Condensed', sans-serif; font-size: 2.5rem; font-weight: 900; color: var(--text); line-height: 1; }
.plan-period { font-size: 1rem; color: var(--muted); margin-left: 0.15rem; }

.status-badge {
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 800;
  letter-spacing: 0.15em; padding: 0.2rem 0.6rem; display: inline-block;
}
.status-badge.active    { background: rgba(52,199,89,0.1);  color: #34C759; border: 1px solid rgba(52,199,89,0.3); }
.status-badge.trialing  { background: rgba(74,158,255,0.1); color: var(--accent); border: 1px solid rgba(74,158,255,0.3); }
.status-badge.past_due  { background: rgba(255,180,0,0.1);  color: var(--gold); border: 1px solid rgba(255,180,0,0.3); }
.status-badge.suspended,
.status-badge.canceled  { background: rgba(255,107,107,0.1); color: var(--danger); border: 1px solid rgba(255,107,107,0.3); }

.trial-warning { background: rgba(74,158,255,0.06); border: 1px solid rgba(74,158,255,0.2); padding: 0.65rem 1rem; font-size: 0.82rem; color: var(--accent); display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
.billing-meta  { font-size: 0.78rem; color: var(--muted); }
.cancel-notice { color: var(--danger); }

/* Usage */
.usage-card { padding: 1.25rem; margin-bottom: 1rem; }
.usage-row  { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.75rem; }
.usage-label { font-family: 'Barlow Condensed', sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; color: var(--muted); width: 70px; flex-shrink: 0; }
.usage-bar-wrap { flex: 1; height: 4px; background: var(--surface); }
.usage-bar  { height: 100%; background: var(--accent); transition: width 0.3s; }
.usage-bar.danger { background: var(--danger); }
.usage-count { font-family: 'Barlow Condensed', sans-serif; font-size: 0.82rem; font-weight: 700; color: var(--sub); width: 72px; text-align: right; flex-shrink: 0; }

/* Upgrade plans */
.plans-row   { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.plan-option { padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
.po-name     { font-family: 'Barlow Condensed', sans-serif; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.15em; color: var(--muted); }
.po-price    { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: var(--text); line-height: 1; }
.po-period   { font-size: 0.9rem; color: var(--muted); }
.po-features { list-style: none; padding: 0; margin: 0.5rem 0; display: flex; flex-direction: column; gap: 0.35rem; }
.po-features li { font-size: 0.8rem; color: var(--sub); display: flex; align-items: center; gap: 0.4rem; }
.po-features .pi-check { color: #34C759; font-size: 0.7rem; }
.po-btn { margin-top: auto; width: 100%; }

/* Manage billing */
.manage-card { padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; }
.manage-title { font-family: 'Barlow Condensed', sans-serif; font-size: 1rem; font-weight: 700; color: var(--text); letter-spacing: 0.05em; }
.manage-sub   { font-size: 0.78rem; color: var(--muted); margin-top: 0.2rem; }

.empty-state { text-align: center; padding: 4rem 2rem; color: var(--sub); }
.empty-icon  { font-size: 2.5rem; color: var(--muted); display: block; margin-bottom: 1rem; }
</style>
