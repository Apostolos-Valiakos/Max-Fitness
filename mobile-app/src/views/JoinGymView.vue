<template>
  <div class="join-shell">
    <div class="join-card">

      <button v-if="!fromOnboarding" class="back-btn" @click="router.back()">
        <i class="pi pi-arrow-left" />
      </button>

      <div class="join-heading">JOIN A GYM</div>
      <p class="join-sub">Enter the 6-character code your gym admin gave you.</p>

      <div class="code-field">
        <input
          v-model="code"
          class="code-input"
          type="text"
          maxlength="6"
          placeholder="ABC123"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="characters"
          spellcheck="false"
          @input="code = (code as string).toUpperCase()"
        />
      </div>

      <div v-if="found" class="gym-preview">
        <i class="pi pi-building" />
        <span>{{ found.name }}</span>
      </div>

      <div v-if="error" class="join-error">{{ error }}</div>

      <button
        class="join-btn"
        :disabled="code.length < 6 || joining"
        @click="handleJoin"
      >
        <i v-if="joining" class="pi pi-spin pi-spinner" />
        <span v-else>{{ found ? 'CONFIRM JOIN' : 'FIND GYM' }}</span>
      </button>

      <button class="skip-btn" @click="router.replace('/dashboard')">
        Skip for now
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const route  = useRoute()
const auth   = useAuthStore()

const fromOnboarding = route.query.onboarding === '1'

const code   = ref('')
const found  = ref<{ id: string; name: string; max_clients: number } | null>(null)
const error  = ref('')
const joining = ref(false)

// Auto-lookup when 6 chars entered
watch(code, async (val) => {
  found.value = null; error.value = ''
  if (val.length !== 6) return
  const { data, error: e } = await supabase
    .from('gyms')
    .select('id, name, max_clients')
    .eq('join_code', val)
    .maybeSingle()
  if (data) found.value = data
  else if (e) error.value = e.message
  else error.value = 'No gym found with that code.'
})

async function handleJoin() {
  if (!found.value || !auth.user) return
  joining.value = true; error.value = ''

  if (found.value.max_clients < 9999) {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', found.value.id)
      .eq('role', 'user')
    if ((count ?? 0) >= found.value.max_clients) {
      error.value = 'This gym has reached its member limit. Contact the gym admin.'
      joining.value = false
      return
    }
  }

  const { error: e } = await supabase
    .from('profiles')
    .update({ gym_id: found.value.id })
    .eq('id', auth.user.id)

  if (e) {
    error.value = e.message
    joining.value = false
    return
  }

  await auth.fetchProfile(auth.user.id)
  router.replace('/dashboard')
}
</script>

<style scoped>
.join-shell {
  min-height: 100dvh; background: var(--bg);
  display: flex; align-items: center; justify-content: center; padding: 2rem 1.5rem;
}
.join-card { width: 100%; max-width: 380px; position: relative; }

.back-btn {
  position: absolute; top: 0; left: 0;
  background: none; border: none; color: var(--muted); font-size: 1.1rem;
  cursor: pointer; padding: 0.25rem; line-height: 1;
}
.back-btn:active { color: var(--accent); }

.join-heading {
  font-family: 'Barlow Condensed', sans-serif; font-size: 1.8rem; font-weight: 900;
  color: var(--text); letter-spacing: 0.05em; margin-bottom: 0.5rem;
  padding-top: 2.5rem;
}
.join-sub { font-size: 0.82rem; color: var(--muted); margin-bottom: 2rem; line-height: 1.5; }

.code-field { margin-bottom: 1rem; }
.code-input {
  width: 100%; background: var(--bg); border: 1px solid var(--border);
  color: var(--text); font-family: 'Barlow Condensed', sans-serif;
  font-size: 2rem; font-weight: 900; letter-spacing: 0.5em;
  text-align: center; padding: 0.75rem 0.5rem;
  text-transform: uppercase;
}
.code-input:focus { outline: none; border-color: var(--accent); }
.code-input::placeholder { color: var(--border); letter-spacing: 0.3em; }

.gym-preview {
  display: flex; align-items: center; gap: 0.6rem;
  background: rgba(52,199,89,0.06); border: 1px solid rgba(52,199,89,0.25);
  color: #34C759; padding: 0.7rem 1rem; font-size: 0.88rem;
  font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: 0.05em;
  margin-bottom: 1rem;
}

.join-error {
  font-size: 0.8rem; color: var(--accent); margin-bottom: 1rem;
  background: rgba(74,158,255,0.08); border: 1px solid rgba(74,158,255,0.2);
  padding: 0.6rem 0.75rem;
}

.join-btn {
  width: 100%; background: var(--accent); border: none; color: #fff;
  font-family: 'Barlow Condensed', sans-serif; font-size: 1rem; font-weight: 800;
  letter-spacing: 0.15em; padding: 0.9rem; cursor: pointer;
  clip-path: var(--clip-md); transition: background 0.15s; margin-bottom: 1rem;
}
.join-btn:disabled { background: var(--border); cursor: not-allowed; }
.join-btn:not(:disabled):active { background: #3B8EEF; }

.skip-btn {
  width: 100%; background: none; border: none;
  color: var(--muted); font-size: 0.82rem; cursor: pointer; padding: 0.5rem;
  text-decoration: underline;
}
</style>
