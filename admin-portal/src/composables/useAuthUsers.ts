import { ref, computed } from 'vue'
import { callAdminFunction } from '@/lib/adminApi'

type AuthUser = { id: string; email: string; created_at: string; last_sign_in_at: string | null }

export function useAuthUsers() {
  const authUsers = ref<AuthUser[]>([])
  const authMap   = computed(() => Object.fromEntries(authUsers.value.map(u => [u.id, u])) as Record<string, AuthUser>)
  const emailMap  = computed(() => Object.fromEntries(authUsers.value.map(u => [u.id, u.email])) as Record<string, string>)

  async function fetchAuthUsers() {
    const { users } = await callAdminFunction<{ users: AuthUser[] }>('admin-users', { action: 'list' })
    authUsers.value = users
  }

  return { authUsers, authMap, emailMap, fetchAuthUsers }
}
