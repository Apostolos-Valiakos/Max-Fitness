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
}

export const useAuthStore = defineStore('auth', () => {
  const user    = ref<User | null>(null)
  const profile = ref<AdminProfile | null>(null)
  const loading = ref(true)

  const isAdmin = computed(() => profile.value?.role === 'admin')

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
      .select('id, role, tier, full_name')
      .eq('id', authUser.id)
      .single()
    if (data) {
      profile.value = { ...data, email: authUser.email ?? '' } as AdminProfile
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
  }

  return { user, profile, loading, isAdmin, init, signOut }
})
