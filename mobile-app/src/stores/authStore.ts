import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { Network } from '@capacitor/network'
import { Preferences } from '@capacitor/preferences'
import type { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  role: 'user' | 'trainer' | 'admin'
  tier: 'free' | 'paid' | 'ultra'
  full_name: string | null
  avatar_url: string | null
  bio: string | null
}

const CACHE_KEY   = 'auth_cache'
const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true'

const BYPASS_USER: User    = { id: 'local-test-user-000000000001', email: 'test@maxfitness.local' } as unknown as User
const BYPASS_PROFILE: Profile = { id: 'local-test-user-000000000001', role: 'user', tier: 'ultra', full_name: 'Test User', avatar_url: null, bio: null }

export const useAuthStore = defineStore('auth', () => {
  const user      = ref<User | null>(null)
  const profile   = ref<Profile | null>(null)
  const loading   = ref(true)
  const isOffline = ref(false)

  const isAdmin   = computed(() => profile.value?.role === 'admin')
  const isTrainer = computed(() => profile.value?.role === 'trainer')
  const isFree    = computed(() => profile.value?.tier === 'free')
  const isUltra   = computed(() => profile.value?.tier === 'ultra')

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
      await fetchProfile(session.user.id)
      await _cacheAuth()
      isOffline.value = false
    } else {
      const { connected } = await Network.getStatus()
      if (!connected) {
        await _loadCachedAuth()
      }
    }

    loading.value = false

    supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user ?? null
      if (session?.user) {
        await fetchProfile(session.user.id)
        await _cacheAuth()
        isOffline.value = false
      } else if (!isOffline.value) {
        profile.value = null
      }
    })
  }

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) profile.value = data as Profile
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

  return {
    user, profile, loading, isOffline,
    isAdmin, isTrainer, isFree, isUltra,
    init, fetchProfile, updateProfile, uploadAvatar, changePassword, signOut,
  }
})
