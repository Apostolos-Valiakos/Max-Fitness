<template>
  <div class="auth-shell">
    <div class="auth-card">
      <div class="auth-brand">
        <span class="b-max">MAX</span><span class="b-fit">FITNESS</span>
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

        <div v-if="error" class="auth-error">
          <i class="pi pi-exclamation-triangle" /> {{ error }}
        </div>

        <Button :label="isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'" type="submit" :loading="loading" class="auth-btn" />
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
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

const router = useRouter();
const route  = useRoute();

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
  loading.value = false;
  if (e) { error.value = e.message; return }

  // Email confirmation required — session is null until confirmed
  if (!data.session) {
    error.value = "Check your email to confirm your account, then click the invite link again."
    return
  }

  // Signed in immediately — redirect to invite or default landing
  if (redirect) { router.push(redirect); return }
  router.push('/dashboard');
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
  align-items: baseline;
  gap: 0.25rem;
  margin-bottom: 2rem;
}
.b-max {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 1.8rem;
  font-weight: 900;
  color: var(--accent);
}
.b-fit {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 1.8rem;
  font-weight: 900;
  color: #f0f0f0;
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
