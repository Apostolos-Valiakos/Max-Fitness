import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ImpersonatedGym {
  id:   string
  name: string
}

export const useOwnerStore = defineStore('owner', () => {
  const impersonatingGym = ref<ImpersonatedGym | null>(null)

  function startImpersonating(gym: ImpersonatedGym) {
    impersonatingGym.value = gym
  }

  function stopImpersonating() {
    impersonatingGym.value = null
  }

  return { impersonatingGym, startImpersonating, stopImpersonating }
})
