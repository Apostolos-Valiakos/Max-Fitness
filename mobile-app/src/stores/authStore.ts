import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { Network } from '@capacitor/network'
import { Preferences } from '@capacitor/preferences'
import type { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  role: 'user' | 'trainer' | 'admin' | 'owner'
  tier: 'free' | 'paid' | 'ultra'
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  gym_id: string | null
  gym_name: string | null
  trainer_subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | null
  trainer_trial_ends_at: string | null
}

const CACHE_KEY   = 'auth_cache'
const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true'

const BYPASS_USER: User    = { id: 'local-test-user-000000000001', email: 'test@maxfitness.local' } as unknown as User
const BYPASS_PROFILE: Profile = { id: 'local-test-user-000000000001', role: 'user', tier: 'ultra', full_name: 'Test User', avatar_url: null, bio: null, gym_id: null, gym_name: null, trainer_subscription_status: null, trainer_trial_ends_at: null }

export const useAuthStore = defineStore('auth', () => {
  const user      = ref<User | null>(null)
  const profile   = ref<Profile | null>(null)
  const loading   = ref(true)
  const isOffline = ref(false)

  const isAdmin   = computed(() => profile.value?.role === 'admin')
  const isTrainer = computed(() => profile.value?.role === 'trainer' || profile.value?.role === 'admin')
  const isFree    = computed(() => profile.value?.tier === 'free')
  const isUltra   = computed(() => profile.value?.tier === 'ultra')
  const hasGym    = computed(() => !!profile.value?.gym_id)

  // Standalone (gym-less) trainer trial/subscription state. NULL status means
  // "not enrolled in self-serve billing" (gym-affiliated or owner/admin-promoted
  // trainers) and is never trialing/locked.
  const isStandaloneTrainer = computed(() => profile.value?.role === 'trainer' && !profile.value?.gym_id)

  const isTrainerTrialing = computed(() => profile.value?.trainer_subscription_status === 'trialing')

  const isTrainerTrialExpired = computed(() =>
    isTrainerTrialing.value &&
    !!profile.value?.trainer_trial_ends_at &&
    new Date(profile.value.trainer_trial_ends_at) < new Date()
  )

  const trainerTrialDaysLeft = computed<number | null>(() => {
    if (!isTrainerTrialing.value || !profile.value?.trainer_trial_ends_at) return null
    return Math.floor((new Date(profile.value.trainer_trial_ends_at).getTime() - Date.now()) / 86_400_000)
  })

  const isTrainerLocked = computed(() =>
    isStandaloneTrainer.value &&
    (profile.value?.trainer_subscription_status === 'canceled' || isTrainerTrialExpired.value)
  )
  const isTrainerPastDue = computed(() => profile.value?.trainer_subscription_status === 'past_due')

  async function init() {
    loading.value = true

    if (BYPASS_AUTH) {
      user.value    = BYPASS_USER
      profile.value = BYPASS_PROFILE
      isOffline.value = true
      loading.value = false
      return
    }

    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      user.value = session.user
      const { connected } = await Network.getStatus()
      if (connected) {
        await fetchProfile(session.user.id)
        await _cacheAuth()
        isOffline.value = false
      } else {
        // Offline but have a valid local session — load cached profile
        await _loadCachedAuth()
        // Keep user from the real session (has full JWT data), only override profile
        user.value = session.user
      }
    } else {
      const { connected } = await Network.getStatus()
      if (!connected) {
        await _loadCachedAuth()
      }
    }

    loading.value = false

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        user.value = null
        profile.value = null
        isOffline.value = false
        return
      }
      if (session?.user) {
        user.value = session.user
        isOffline.value = false
        // Fire-and-forget: don't block signInWithPassword() while fetching profile.
        // The auth store's signIn() already set user.value synchronously; profile
        // arrives a moment later without stalling the router navigation.
        fetchProfile(session.user.id).then(() => _cacheAuth()).catch(() => {})
      }
      // For INITIAL_SESSION or TOKEN_REFRESH_FAILURE with no session,
      // preserve existing user/profile so the UI doesn't flicker to logged-out state.
    })
  }

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, tier, full_name, avatar_url, bio, gym_id, trainer_subscription_status, trainer_trial_ends_at, gyms(name)')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('[authStore] fetchProfile error, retrying without join:', error.message)
      // Fallback: fetch without the gyms join
      const { data: data2 } = await supabase
        .from('profiles')
        .select('id, role, tier, full_name, avatar_url, bio, gym_id, trainer_subscription_status, trainer_trial_ends_at')
        .eq('id', userId)
        .single()
      if (data2) {
        profile.value = { ...data2, gym_name: null } as Profile
      }
      return
    }
    if (data) {
      const { gyms, ...rest } = data as any
      profile.value = { ...rest, gym_name: (gyms as any)?.name ?? null } as Profile
    }
  }

  async function updateProfile(updates: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'bio'>>) {
    if (!user.value) return
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.value.id)
    if (!error) {
      profile.value = { ...profile.value!, ...updates }
      await _cacheAuth()
    }
  }

  async function uploadAvatar(file: File): Promise<string | null> {
    if (!user.value) return null
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.value.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl + '?t=' + Date.now()
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<string | null> {
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.value?.email ?? '',
      password: currentPassword,
    })
    if (signInErr) return 'Current password is incorrect.'
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return error?.message ?? null
  }

  async function signOut() {
    await supabase.auth.signOut()
    await Preferences.remove({ key: CACHE_KEY })
    user.value    = null
    profile.value = null
    isOffline.value = false
  }

  async function _cacheAuth() {
    if (!user.value || !profile.value) return
    await Preferences.set({
      key: CACHE_KEY,
      value: JSON.stringify({ id: user.value.id, email: user.value.email, profile: profile.value }),
    })
  }

  async function _loadCachedAuth() {
    const { value } = await Preferences.get({ key: CACHE_KEY })
    if (!value) return
    const cached = JSON.parse(value)
    user.value    = { id: cached.id, email: cached.email } as User
    profile.value = cached.profile
    isOffline.value = true
  }

  async function signIn(email: string, password: string): Promise<string | null> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message
    // Set user synchronously so the router guard sees it before router.replace() runs.
    // onAuthStateChange will handle fetchProfile + _cacheAuth asynchronously.
    if (data.session?.user) user.value = data.session.user
    return null
  }

  return {
    user, profile, loading, isOffline,
    isAdmin, isTrainer, isFree, isUltra, hasGym,
    isStandaloneTrainer, isTrainerTrialing, isTrainerTrialExpired, trainerTrialDaysLeft, isTrainerLocked, isTrainerPastDue,
    init, signIn, fetchProfile, updateProfile, uploadAvatar, changePassword, signOut,
  }
})
