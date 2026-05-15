import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  role: 'user' | 'trainer' | 'admin'
  tier: 'free' | 'paid' | 'ultra'
  full_name: string | null
  avatar_url: string | null
}

export const useAuthStore = defineStore('auth', () => {
  const user    = ref<User | null>(null)
  const profile = ref<Profile | null>(null)
  const loading = ref(true)

  const isAdmin   = computed(() => profile.value?.role === 'admin')
  const isTrainer = computed(() => profile.value?.role === 'trainer')
  const isFree    = computed(() => profile.value?.tier === 'free')
  const isUltra   = computed(() => profile.value?.tier === 'ultra')

  async function init() {
    loading.value = true
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) { user.value = session.user; await fetchProfile(session.user.id) }
    loading.value = false
    supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user ?? null
      if (session?.user) await fetchProfile(session.user.id)
      else profile.value = null
    })
  }

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) profile.value = data as Profile
  }

  async function updateProfile(updates: Partial<Pick<Profile, 'full_name' | 'avatar_url'>>) {
    if (!user.value) return
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.value.id)
    if (!error) profile.value = { ...profile.value!, ...updates }
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null; profile.value = null
  }

  return { user, profile, loading, isAdmin, isTrainer, isFree, isUltra, init, fetchProfile, updateProfile, signOut }
})
