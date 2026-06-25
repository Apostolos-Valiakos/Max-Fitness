import { computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useOwnerStore } from '@/stores/ownerStore'

export function useGymFilter() {
  const auth  = useAuthStore()
  const owner = useOwnerStore()

  const activeGymId = computed<string | null>(() => {
    if (auth.isOwner) return owner.impersonatingGym?.id ?? null
    return auth.profile?.gym_id ?? null
  })

  return { activeGymId }
}
