<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">MAX<span class="accent">FITNES</span></div>
      <div class="auth-subtitle">TRACK. PROGRESS. DOMINATE.</div>

      <div class="tab-row">
        <button class="tab" :class="{ active: mode === 'login' }"    @click="mode = 'login'">SIGN IN</button>
        <button class="tab" :class="{ active: mode === 'register' }" @click="mode = 'register'">SIGN UP</button>
      </div>

      <div class="form">
        <div class="field">
          <label>EMAIL</label>
          <input v-model="email" type="email" inputmode="email" autocomplete="email" class="auth-input" placeholder="you@example.com" />
        </div>
        <div class="field">
          <label>PASSWORD</label>
          <input v-model="password" type="password" autocomplete="current-password" class="auth-input" placeholder="••••••••" />
        </div>
        <div v-if="mode === 'register'" class="field">
          <label>FULL NAME</label>
          <input v-model="fullName" type="text" autocomplete="name" class="auth-input" placeholder="John Doe" />
        </div>
        <div v-if="error" class="auth-error">{{ error }}</div>
        <button class="auth-btn" :disabled="loading" @click="handleSubmit">
          <i v-if="loading" class="pi pi-spin pi-spinner" />
          <span v-else>{{ mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const router   = useRouter()
const auth     = useAuthStore()
const mode     = ref<'login' | 'register'>('login')
const email    = ref('')
const password = ref('')
const fullName = ref('')
const error    = ref('')
const loading  = ref(false)

async function handleSubmit() {
  error.value = ''; loading.value = true
  try {
    if (mode.value === 'login') {
      // Use store's signIn so auth.user is set before router guard runs
      const errMsg = await auth.signIn(email.value, password.value)
      if (errMsg) { error.value = errMsg; return }
      router.replace('/dashboard')
    } else {
      const { error: e } = await supabase.auth.signUp({
        email: email.value, password: password.value,
        options: { data: { full_name: fullName.value } },
      })
      if (e) { error.value = e.message; return }
      // New users land on join-gym so they can optionally link to a gym
      router.replace('/join-gym?onboarding=1')
    }
  } finally { loading.value = false }
}
</script>

<style scoped>
.auth-page{min-height:100dvh;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:1.5rem;}
.auth-card{width:100%;max-width:360px;}
.auth-logo{font-family:'Barlow Condensed',sans-serif;font-size:3rem;font-weight:900;color:var(--text);letter-spacing:-0.02em;line-height:1;margin-bottom:0.25rem;}
.accent{color:var(--accent);}
.auth-subtitle{font-family:'Barlow Condensed',sans-serif;font-size:0.72rem;font-weight:700;letter-spacing:0.3em;color:var(--muted);margin-bottom:2.5rem;}
.tab-row{display:flex;gap:0;margin-bottom:1.5rem;border-bottom:1px solid var(--surface);}
.tab{flex:1;background:none;border:none;border-bottom:2px solid transparent;color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-size:0.85rem;font-weight:700;letter-spacing:0.2em;padding:0.65rem;cursor:pointer;margin-bottom:-1px;transition:all 0.2s;}
.tab.active{color:var(--accent);border-bottom-color:var(--accent);}
.form{display:flex;flex-direction:column;gap:1rem;}
.field{display:flex;flex-direction:column;gap:0.35rem;}
label{font-family:'Barlow Condensed',sans-serif;font-size:0.68rem;font-weight:700;letter-spacing:0.2em;color:var(--muted);}
.auth-input{background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:'DM Sans',sans-serif;font-size:0.95rem;padding:0.75rem;width:100%;}
.auth-input:focus{outline:none;border-color:var(--accent);}
.auth-error{background:rgba(74,158,255,0.1);border:1px solid rgba(74,158,255,0.3);color:var(--accent);font-size:0.8rem;padding:0.65rem;border-radius:0;}
.auth-btn{background:var(--accent);border:none;color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:1rem;font-weight:800;letter-spacing:0.15em;padding:0.9rem;cursor:pointer;transition:background 0.2s;clip-path:var(--clip-md);margin-top:0.5rem;}
.auth-btn:active{background:#3B8EEF;}.auth-btn:disabled{background:var(--border);cursor:not-allowed;}
</style>
