<template>
  <div class="auth-shell">
    <div class="auth-card">
      <div class="auth-brand">
        <BrandMark :size="30" />
        <span class="b-word">FERRUM</span>
        <span class="b-admin">ADMIN PORTAL</span>
      </div>

      <form class="auth-form" @submit.prevent="isSignUp ? handleSignUp() : handleLogin()">
        <div class="field">
          <label class="mf-label">EMAIL</label>
          <InputText v-model="email" type="email" placeholder="admin@example.com" autocomplete="email" required />
        </div>
        <div class="field">
          <label class="mf-label">PASSWORD</label>
          <InputText v-model="password" type="password" placeholder="••••••••"
            :autocomplete="isSignUp ? 'new-password' : 'current-password'" required />
        </div>

        <p v-if="isSignUp" class="signup-note">
          Creates an independent trainer account — no gym required. 14 days free, then a monthly subscription to keep going.
        </p>

        <div v-if="error" class="auth-error">
          <i class="pi pi-exclamation-triangle" /> {{ error }}
        </div>

        <Button :label="isSignUp ? 'START FREE TRIAL' : 'SIGN IN'" type="submit" :loading="loading" class="auth-btn" />
      </form>

      <div class="mode-toggle">
        <template v-if="isSignUp">
          Already have an account?
          <a href="#" @click.prevent="mode = 'signin'; error = ''">Sign in</a>
        </template>
        <template v-else>
          Need an account?
          <a href="#" @click.prevent="mode = 'signup'; error = ''">Create one</a>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import BrandMark from '@/components/BrandMark.vue'

const router = useRouter();
const route  = useRoute();
const auth   = useAuthStore();

const mode     = ref<'signin' | 'signup'>(route.query.mode === 'signup' ? 'signup' : 'signin')
const isSignUp = computed(() => mode.value === 'signup')

const email    = ref((route.query.email as string) ?? "");
const password = ref("");
const error    = ref("");
const loading  = ref(false);

const redirect = route.query.redirect as string | undefined

async function handleLogin() {
  error.value = "";
  loading.value = true;
  const { error: e } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  });
  loading.value = false;
  if (e) { error.value = e.message; return }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!['admin', 'trainer', 'owner'].includes(profile?.role ?? '')) {
    await supabase.auth.signOut();
    error.value = "Access denied. This portal is for gym staff only.";
    return;
  }

  if (redirect) { router.push(redirect); return }
  if (profile?.role === 'owner')   { router.push('/owner/gyms'); return }
  if (profile?.role === 'trainer') { router.push('/trainer/clients'); return }
  router.push('/dashboard');
}

async function handleSignUp() {
  error.value = "";
  loading.value = true;
  const { data, error: e } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
  });

  // Email confirmation required — session is null until confirmed, and the
  // trial can't start without a JWT. Not handled here: if Supabase is ever
  // configured to require confirmation (it isn't today — no config.toml sets
  // it), this signup would need a separate confirmed-first-login trigger.
  if (!data.session) {
    loading.value = false;
    if (e) { error.value = e.message; return }
    error.value = "Check your email to confirm your account, then sign in to start your free trial."
    return
  }

  // Signed in immediately (email confirmation disabled) — start the trial now.
  const { error: trialErr } = await startTrainerTrial();
  if (trialErr) { loading.value = false; error.value = trialErr; return }

  // The Pinia store's profile was already fetched (as role='user') by the
  // onAuthStateChange listener that fired when signUp() established the
  // session — that happened concurrently with (and before) start-trainer-trial
  // updating the DB row, so the store is now stale. Re-fetch so the sidebar
  // nav/badge reflect role='trainer' immediately instead of on next reload.
  await auth.fetchProfile(data.session.user);
  loading.value = false;

  if (redirect) { router.push(redirect); return }
  router.push('/trainer/clients');
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? `Bearer ${session.access_token}` : null;
}

/** Promotes a fresh role='user' signup to a trialing standalone trainer. Safe to
 *  call more than once — the edge function only acts the first time (see
 *  supabase/functions/start-trainer-trial). */
async function startTrainerTrial(): Promise<{ error: string | null }> {
  const authHeader = await getAuthHeader();
  if (!authHeader) return { error: null };

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/start-trainer-trial`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body:    JSON.stringify({}),
    });
    if (!res.ok && res.status !== 409) {
      const json = await res.json().catch(() => ({}));
      return { error: json.error ?? 'Could not start your free trial. Please try again.' };
    }
    return { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
}
</script>

<style scoped>
.auth-shell {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}
.auth-card {
  width: 100%;
  max-width: 380px;
  background: var(--bg);
  border: 1px solid var(--surface);
  padding: 2.5rem 2rem;
}
.auth-brand {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 2rem;
}
.b-word {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 1.8rem;
  font-weight: 900;
  color: #f0f0f0;
  letter-spacing: 0.02em;
}
.b-admin {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--muted);
  width: 100%;
  margin-top: -0.25rem;
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.signup-note {
  font-size: 0.76rem;
  color: var(--muted);
  line-height: 1.5;
  margin: -0.4rem 0 0;
}
.auth-error {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--accent);
  background: rgba(74, 158, 255, 0.08);
  border: 1px solid rgba(74, 158, 255, 0.2);
  padding: 0.6rem 0.75rem;
}
.auth-btn { width: 100%; justify-content: center; margin-top: 0.25rem; }
.mode-toggle {
  text-align: center;
  margin-top: 1.25rem;
  font-size: 0.78rem;
  color: var(--muted);
}
.mode-toggle a {
  color: var(--accent);
  text-decoration: none;
  margin-left: 0.25rem;
}
.mode-toggle a:hover { text-decoration: underline; }
</style>
