<template>
  <div class="auth-wrap">
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

const router   = useRouter()
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
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
      if (e) { error.value = e.message; return }
    } else {
      const { error: e } = await supabase.auth.signUp({
        email: email.value, password: password.value,
        options: { data: { full_name: fullName.value } },
      })
      if (e) { error.value = e.message; return }
    }
    router.replace('/dashboard')
  } finally { loading.value = false }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap');
.auth-wrap{min-height:100dvh;background:#0A0A0A;display:flex;align-items:center;justify-content:center;padding:1.5rem;}
.auth-card{width:100%;max-width:360px;}
.auth-logo{font-family:'Barlow Condensed',sans-serif;font-size:3rem;font-weight:900;color:#F0F0F0;letter-spacing:-0.02em;line-height:1;margin-bottom:0.25rem;}
.accent{color:#FF4D00;}
.auth-subtitle{font-family:'Barlow Condensed',sans-serif;font-size:0.72rem;font-weight:700;letter-spacing:0.3em;color:#444;margin-bottom:2.5rem;}
.tab-row{display:flex;gap:0;margin-bottom:1.5rem;border-bottom:1px solid #1A1A1A;}
.tab{flex:1;background:none;border:none;border-bottom:2px solid transparent;color:#444;font-family:'Barlow Condensed',sans-serif;font-size:0.85rem;font-weight:700;letter-spacing:0.2em;padding:0.65rem;cursor:pointer;margin-bottom:-1px;transition:all 0.2s;}
.tab.active{color:#FF4D00;border-bottom-color:#FF4D00;}
.form{display:flex;flex-direction:column;gap:1rem;}
.field{display:flex;flex-direction:column;gap:0.35rem;}
label{font-family:'Barlow Condensed',sans-serif;font-size:0.68rem;font-weight:700;letter-spacing:0.2em;color:#555;}
.auth-input{background:#111;border:1px solid #2A2A2A;color:#F0F0F0;font-family:'DM Sans',sans-serif;font-size:0.95rem;padding:0.75rem;width:100%;}
.auth-input:focus{outline:none;border-color:#FF4D00;}
.auth-error{background:rgba(255,77,0,0.1);border:1px solid rgba(255,77,0,0.3);color:#FF4D00;font-size:0.8rem;padding:0.65rem;border-radius:0;}
.auth-btn{background:#FF4D00;border:none;color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:1rem;font-weight:800;letter-spacing:0.15em;padding:0.9rem;cursor:pointer;transition:background 0.2s;clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);margin-top:0.5rem;}
.auth-btn:active{background:#CC3D00;}.auth-btn:disabled{background:#2A2A2A;cursor:not-allowed;}
</style>
