import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { UserRole, UserTier } from '@/lib/database.types'
import type { User } from '@supabase/supabase-js'

export interface AdminProfile {
  id: string
  role: UserRole
  tier: UserTier
  full_name: string | null
  email: string
  avatar_url: string | null
  bio: string | null
}

export const useAuthStore = defineStore('auth', () => {
  const user    = ref<User | null>(null)
  const profile = ref<AdminProfile | null>(null)
  const loading = ref(true)

  const isAdmin   = computed(() => profile.value?.role === 'admin')
  const isTrainer = computed(() => profile.value?.role === 'trainer')
  const isStaff   = computed(() => profile.value?.role === 'admin' || profile.value?.role === 'trainer')

  async function init() {
    loading.value = true
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      user.value = session.user
      await fetchProfile(session.user)
    }
    loading.value = false

    supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user ?? null
      if (session?.user) await fetchProfile(session.user)
      else profile.value = null
    })
  }

  async function fetchProfile(authUser: User) {
    const { data } = await supabase
      .from('profiles')
      .select('id, role, tier, full_name, avatar_url, bio')
      .eq('id', authUser.id)
      .single()
    if (data) {
      profile.value = { ...data, email: authUser.email ?? '' } as AdminProfile
    }
  }

  async function updateProfile(updates: { full_name?: string | null; avatar_url?: string | null; bio?: string | null }) {
    if (!user.value) return
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.value.id)
    if (!error && profile.value) profile.value = { ...profile.value, ...updates }
  }

  async function uploadAvatar(file: File): Promise<string | null> {
    if (!user.value) return null
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.value.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    // Bust cache so the browser fetches the new image
    return data.publicUrl + '?t=' + Date.now()
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<string | null> {
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: profile.value?.email ?? '',
      password: currentPassword,
    })
    if (signInErr) return 'Current password is incorrect.'
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return error?.message ?? null
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
  }

  return { user, profile, loading, isAdmin, isTrainer, isStaff, init, updateProfile, uploadAvatar, changePassword, signOut }
})
