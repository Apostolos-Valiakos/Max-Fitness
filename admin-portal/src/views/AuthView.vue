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
          <InputText v-model="email" type="email" placeholder="admin@example.com" autocomplete="email" required />
        </div>
        <div class="field">
          <label class="mf-label">PASSWORD</label>
          <InputText v-model="password" type="password" placeholder="••••••••" autocomplete="current-password" required />
        </div>

        <div v-if="error" class="auth-error">
          <i class="pi pi-exclamation-triangle" /> {{ error }}
        </div>

        <Button label="SIGN IN" type="submit" :loading="loading" class="auth-btn" />
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "@/lib/supabase";
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);
const router = useRouter();

async function handleLogin() {
  error.value = "";
  loading.value = true;
  const { error: e } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  });
  loading.value = false;
  if (e) {
    error.value = e.message;
    return;
  }

  // Verify this user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "trainer") {
    await supabase.auth.signOut();
    error.value = "Access denied. This portal is for admins and trainers only.";
    return;
  }

  router.push(profile?.role === "trainer" ? "/trainer/clients" : "/dashboard");
}
</script>

<style scoped>
.auth-shell {
  min-height: 100vh;
  background: #1C1C1E;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}
.auth-card {
  width: 100%;
  max-width: 380px;
  background: #1C1C1E;
  border: 1px solid #252528;
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
  color: #4A9EFF;
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
  color: #636366;
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
  color: #4A9EFF;
  background: rgba(74, 158, 255, 0.08);
  border: 1px solid rgba(74, 158, 255, 0.2);
  padding: 0.6rem 0.75rem;
}
.auth-btn { width: 100%; justify-content: center; margin-top: 0.25rem; }
</style>
