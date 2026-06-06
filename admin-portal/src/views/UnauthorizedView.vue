<template>
  <div class="unauth">
    <i class="pi pi-lock unauth-icon" />
    <h1>Access Denied</h1>
    <p>This portal is restricted to admin accounts.</p>
    <button class="btn btn-ghost" @click="handleBack">Sign in with a different account</button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = useRouter()
async function handleBack() {
  await supabase.auth.signOut()
  router.push('/auth')
}
</script>

<style scoped>
.unauth { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; text-align: center; padding: 2rem; }
.unauth-icon { font-size: 3rem; color: var(--border); }
h1 { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: var(--text); }
p  { color: var(--muted); font-size: 0.88rem; }
</style>
