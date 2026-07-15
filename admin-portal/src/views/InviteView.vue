<template>
  <div class="invite-shell">
    <div class="invite-card">

      <!-- Brand -->
      <div class="brand">
        <BrandMark :size="26" />
        <span class="b-word">FERRUM</span>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="state-center">
        <i class="pi pi-spin pi-spinner" style="font-size:1.5rem;color:var(--muted)" />
      </div>

      <!-- Invalid / expired / already accepted -->
      <div v-else-if="errorState" class="state-center">
        <i class="pi pi-times-circle err-icon" />
        <div class="err-title">{{ errorState }}</div>
        <router-link to="/auth" class="back-link">← Back to login</router-link>
      </div>

      <!-- Valid invite -->
      <template v-else-if="invite">
        <div class="invite-heading">YOU'VE BEEN INVITED</div>

        <div class="invite-info-card">
          <div class="invite-gym">{{ invite.gyms?.name ?? 'A Gym' }}</div>
          <div class="invite-role-line">
            Role: <span class="role-badge" :class="invite.role">{{ invite.role.toUpperCase() }}</span>
          </div>
          <div class="invite-exp">Expires {{ fmtDate(invite.expires_at) }}</div>
        </div>

        <!-- Already logged in as matching user -->
        <template v-if="currentUser">
          <div v-if="alreadyInGym" class="warn-box">
            <i class="pi pi-exclamation-triangle" />
            Your account is already linked to a gym. Contact your current gym admin to transfer.
          </div>
          <template v-else>
            <div class="accept-note">Logged in as <strong>{{ currentUser.email }}</strong></div>
            <Button label="ACCEPT INVITE" class="accept-btn" :loading="accepting" @click="acceptInvite" />
          </template>
        </template>

        <!-- Not logged in -->
        <template v-else>
          <div class="auth-note">
            Create an account or sign in to accept this invite.
          </div>
          <router-link
            :to="`/auth?mode=signup&email=${encodeURIComponent(invite.email)}&redirect=${encodeURIComponent('/invite/' + token)}`"
            class="signin-btn"
          >
            CREATE ACCOUNT
          </router-link>
          <router-link :to="`/auth?redirect=/invite/${token}`" class="secondary-link">
            Already have an account? Sign in
          </router-link>
        </template>

        <div v-if="acceptError" class="field-error">{{ acceptError }}</div>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { callAdminFunction, callPublicFunction } from '@/lib/adminApi'
import { format } from 'date-fns'
import Button from 'primevue/button'
import BrandMark from '@/components/BrandMark.vue'

const route = useRoute()

const token       = route.params.token as string
const loading     = ref(true)
const invite      = ref<any>(null)
const errorState  = ref('')
const currentUser = ref<any>(null)
const alreadyInGym = ref(false)
const accepting   = ref(false)
const acceptError = ref('')

function fmtDate(iso: string) { return format(new Date(iso), 'MMM d, yyyy') }

onMounted(async () => {
  // Public lookup by token — works before the visitor has signed in.
  let data: any
  try {
    const result = await callPublicFunction<{ invite: any }>('invite-details', { token })
    data = result.invite
  } catch {
    errorState.value = 'Invite not found.'
    loading.value = false
    return
  }

  if (data.accepted_at) {
    errorState.value = 'This invite has already been accepted.'
    loading.value = false
    return
  }
  if (new Date(data.expires_at) < new Date()) {
    errorState.value = 'This invite has expired. Ask your admin to resend it.'
    loading.value = false
    return
  }

  invite.value = data

  // Check current session
  const { data: { user } } = await supabase.auth.getUser()
  currentUser.value = user

  if (user) {
    // Check if user already has a gym
    const { data: profile } = await supabase.from('profiles').select('gym_id').eq('id', user.id).single()
    alreadyInGym.value = !!profile?.gym_id
  }

  loading.value = false
})

async function acceptInvite() {
  if (!invite.value || !currentUser.value) return
  accepting.value = true; acceptError.value = ''

  try {
    const { role } = await callAdminFunction<{ ok: true; role: string }>('accept-invite', { token })
    // Hard-navigate so authStore re-initialises with the new profile
    window.location.href = role === 'trainer' ? '/trainer/clients' : '/dashboard'
  } catch (err: any) {
    acceptError.value = err.message ?? 'Failed to accept invite'
    accepting.value = false
  }
}
</script>

<style scoped>
.invite-shell {
  min-height: 100vh; background: var(--bg);
  display: flex; align-items: center; justify-content: center; padding: 2rem;
}
.invite-card {
  width: 100%; max-width: 420px;
  background: var(--bg); border: 1px solid var(--surface); padding: 2.5rem 2rem;
}

.brand { display: flex; align-items: center; gap: 0.55rem; margin-bottom: 2rem; }
.b-word { font-family: 'Barlow Condensed', sans-serif; font-size: 1.4rem; font-weight: 900; color: var(--text); letter-spacing: 0.05em; }

.state-center { text-align: center; padding: 1.5rem 0; }
.err-icon  { font-size: 2rem; color: var(--danger); display: block; margin-bottom: 0.75rem; }
.err-title { font-size: 0.88rem; color: #AEAEB2; margin-bottom: 1rem; }
.back-link { font-size: 0.78rem; color: var(--accent); text-decoration: none; }
.back-link:hover { text-decoration: underline; }

.invite-heading {
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.72rem; font-weight: 700;
  letter-spacing: 0.2em; color: var(--muted); margin-bottom: 1rem;
}

.invite-info-card {
  background: var(--surface); border: 1px solid var(--border);
  padding: 1.25rem; margin-bottom: 1.5rem;
}
.invite-gym { font-family: 'Barlow Condensed', sans-serif; font-size: 1.5rem; font-weight: 900; color: var(--text); margin-bottom: 0.4rem; }
.invite-role-line { font-size: 0.82rem; color: var(--sub); display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; }
.invite-exp  { font-size: 0.72rem; color: var(--muted); }

.role-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.12rem 0.4rem; border: 1px solid; }
.role-badge.trainer { color: #4DA6FF; border-color: rgba(77,166,255,0.3); background: rgba(77,166,255,0.08); }
.role-badge.admin   { color: #34C759; border-color: rgba(52,199,89,0.3);  background: rgba(52,199,89,0.08);  }

.accept-note { font-size: 0.78rem; color: var(--muted); margin-bottom: 1rem; }
.accept-note strong { color: #AEAEB2; }

.accept-btn { width: 100%; }

.auth-note  { font-size: 0.82rem; color: var(--sub); margin-bottom: 1rem; }
.signin-btn {
  display: block; width: 100%; text-align: center;
  background: var(--accent); color: #fff; text-decoration: none;
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.9rem; font-weight: 700;
  letter-spacing: 0.12em; padding: 0.75rem 1rem;
  clip-path: var(--clip-sm); transition: opacity 0.15s;
}
.signin-btn:hover { opacity: 0.88; }

.secondary-link {
  display: block; text-align: center; margin-top: 0.9rem;
  font-size: 0.78rem; color: var(--muted); text-decoration: none;
}
.secondary-link:hover { color: var(--accent); text-decoration: underline; }

.warn-box {
  background: rgba(255,180,0,0.08); border: 1px solid rgba(255,180,0,0.3);
  color: var(--gold); font-size: 0.8rem; padding: 0.75rem 1rem;
  display: flex; gap: 0.5rem; align-items: flex-start; line-height: 1.4;
}

.field-error { font-size: 0.78rem; color: var(--accent); margin-top: 0.75rem; }
</style>
