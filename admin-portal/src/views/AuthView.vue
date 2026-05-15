<template>
  <div class="auth-shell">
    <div class="auth-card">
      <div class="auth-brand">
        <span class="b-max">MAX</span><span class="b-fit">FITNESS</span>
        <span class="b-admin">ADMIN PORTAL</span>
      </div>

      <form class="auth-form" @submit.prevent="handleLogin">
        <div class="field">
          <label class="mf-label">EMAIL</label>
          <input v-model="email" class="mf-input" type="email" placeholder="admin@example.com" required autocomplete="email" />
        </div>
        <div class="field">
          <label class="mf-label">PASSWORD</label>
          <input v-model="password" class="mf-input" type="password" placeholder="••••••••" required autocomplete="current-password" />
        </div>

        <div v-if="error" class="auth-error"><i class="pi pi-exclamation-triangle" /> {{ error }}</div>

        <button class="btn btn-primary auth-btn" type="submit" :disabled="loading">
          <i v-if="loading" class="pi pi-spin pi-spinner" />
          <span v-else>SIGN IN</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const email    = ref('')
const password = ref('')
const error    = ref('')
const loading  = ref(false)
const router   = useRouter()

async function handleLogin() {
  error.value = ''
  loading.value = true
  const { error: e } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
  loading.value = false
  if (e) { error.value = e.message; return }

  // Verify this user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    await supabase.auth.signOut()
    error.value = 'Access denied. This portal is for admins only.'
    return
  }

  router.push('/dashboard')
}
</script>

<style scoped>
.auth-shell {
  min-height: 100vh; background: #0A0A0A;
  display: flex; align-items: center; justify-content: center;
  padding: 2rem;
}
.auth-card {
  width: 100%; max-width: 380px;
  background: #111; border: 1px solid #1A1A1A;
  padding: 2.5rem 2rem;
}
.auth-brand {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem;
  margin-bottom: 2rem;
}
.b-max  { font-family: 'Barlow Condensed', sans-serif; font-size: 1.8rem; font-weight: 900; color: #FF4D00; }
.b-fit  { font-family: 'Barlow Condensed', sans-serif; font-size: 1.8rem; font-weight: 900; color: #F0F0F0; }
.b-admin { font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em; color: #444; width: 100%; margin-top: -0.25rem; }
.auth-form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.auth-error { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: #FF4D00; background: rgba(255,77,0,0.08); border: 1px solid rgba(255,77,0,0.2); padding: 0.6rem 0.75rem; }
.auth-btn { width: 100%; padding: 0.75rem; font-size: 0.95rem; justify-content: center; display: flex; align-items: center; gap: 0.5rem; }
.auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
