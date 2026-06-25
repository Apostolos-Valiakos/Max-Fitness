import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export interface Gym {
  id:                  string
  name:                string
  slug:                string
  join_code:           string
  plan:                string
  max_trainers:        number
  max_clients:         number
  subscription_status: string
  trial_ends_at:       string | null
  created_at:          string
}

export interface GymSubscription {
  gym_id:               string
  status:               string | null
  current_period_end:   string | null
  cancel_at_period_end: boolean
  monthly_amount_cents: number | null
}

export const useGymStore = defineStore('gym', () => {
  const gym          = ref<Gym | null>(null)
  const subscription = ref<GymSubscription | null>(null)
  const trainerCount = ref(0)
  const clientCount  = ref(0)
  const loading      = ref(false)

  const isTrialing = computed(() => gym.value?.subscription_status === 'trialing')

  const isTrialExpired = computed(() =>
    isTrialing.value &&
    !!gym.value?.trial_ends_at &&
    new Date(gym.value.trial_ends_at) < new Date()
  )

  const trialDaysLeft = computed<number | null>(() => {
    if (!isTrialing.value || !gym.value?.trial_ends_at) return null
    return Math.floor((new Date(gym.value.trial_ends_at).getTime() - Date.now()) / 86_400_000)
  })

  const isLocked = computed(() =>
    gym.value !== null &&
    (['suspended', 'canceled'].includes(gym.value.subscription_status) || isTrialExpired.value)
  )
  const isPastDue = computed(() => gym.value?.subscription_status === 'past_due')

  async function load(gymId: string) {
    loading.value = true
    const [gymRes, subRes, trainerRes, clientRes] = await Promise.all([
      supabase.from('gyms')
        .select('id, name, slug, join_code, plan, max_trainers, max_clients, subscription_status, trial_ends_at, created_at')
        .eq('id', gymId).single(),
      supabase.from('gym_subscriptions')
        .select('gym_id, status, current_period_end, cancel_at_period_end, monthly_amount_cents')
        .eq('gym_id', gymId).maybeSingle(),
      supabase.from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', gymId).in('role', ['trainer', 'admin']),
      supabase.from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', gymId).eq('role', 'user'),
    ])
    gym.value          = gymRes.data   ?? null
    subscription.value = subRes.data   ?? null
    trainerCount.value = trainerRes.count ?? 0
    clientCount.value  = clientRes.count  ?? 0
    loading.value      = false
  }

  function clear() {
    gym.value          = null
    subscription.value = null
    trainerCount.value = 0
    clientCount.value  = 0
  }

  return { gym, subscription, trainerCount, clientCount, loading, isLocked, isPastDue, isTrialing, isTrialExpired, trialDaysLeft, load, clear }
})
