<template>
  <div class="app-shell">
    <!-- Subscription locked (standalone trainer) -->
    <div v-if="auth.isTrainerLocked" class="lockout">
      <div class="lockout-card">
        <i class="pi pi-lock lockout-icon" />
        <h2 class="lockout-title">{{ auth.isTrainerTrialExpired ? 'TRIAL ENDED' : 'ACCESS SUSPENDED' }}</h2>
        <p class="lockout-body">{{ auth.isTrainerTrialExpired ? 'Your 14-day free trial has ended. Subscribe to keep coaching your clients.' : 'Your subscription has lapsed. Renew to restore full access.' }}</p>
        <button class="lockout-btn" :disabled="upgrading" @click="upgradeTrainerPlan">
          <i v-if="upgrading" class="pi pi-spin pi-spinner" /> <span v-else>Subscribe</span>
        </button>
        <div v-if="upgradeError" class="lockout-error">{{ upgradeError }}</div>
        <button class="lockout-signout" @click="handleSignOut">Sign out</button>
      </div>
    </div>

    <template v-else>
      <!-- Past-due / trial banners (standalone trainer) -->
      <div v-if="auth.isTrainerPastDue" class="warning-bar">
        <i class="pi pi-exclamation-triangle" />
        Payment failed — your subscription is past due.
        <button class="warning-link" :disabled="upgrading" @click="upgradeTrainerPlan">Update billing →</button>
      </div>
      <div v-else-if="auth.isTrainerTrialing" class="trial-bar">
        <i class="pi pi-clock" />
        <template v-if="(auth.trainerTrialDaysLeft ?? 0) > 0">
          Trial ends in <strong>{{ auth.trainerTrialDaysLeft }} day{{ auth.trainerTrialDaysLeft === 1 ? '' : 's' }}</strong> —
        </template>
        <template v-else>
          Trial ends <strong>today</strong> —
        </template>
        <button class="trial-link" :disabled="upgrading" @click="upgradeTrainerPlan">Subscribe now →</button>
      </div>

      <!-- Active workout banner -->
      <Transition name="slide-down">
        <div v-if="workout.hasActiveSession" class="active-banner" @click="router.push('/workout/active')">
          <div class="banner-left">
            <span class="banner-dot" />
            <span class="banner-name">{{ workout.activeSession?.name }}</span>
          </div>
          <div class="banner-right">
            <span class="banner-timer">{{ workout.elapsedFormatted }}</span>
            <span class="banner-sets">{{ workout.totalSets }} sets</span>
            <i class="pi pi-chevron-right banner-arrow" />
          </div>
        </div>
      </Transition>

      <!-- Sync status -->
      <SyncStatusBar />

      <!-- Main content -->
      <main class="app-main" :class="{ 'has-banner': workout.hasActiveSession }">
        <router-view v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </router-view>
      </main>

      <!-- Bottom nav -->
      <BottomNav />

      <!-- Rest timer pill (minimized state, visible across all views) -->
      <RestTimerPill />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkoutStore } from '@/stores/workoutStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav.vue'
import SyncStatusBar from '@/components/SyncStatusBar.vue'
import RestTimerPill from '@/components/RestTimerPill.vue'

const router  = useRouter()
const workout = useWorkoutStore()
const auth    = useAuthStore()

const upgrading    = ref(false)
const upgradeError = ref('')

async function upgradeTrainerPlan() {
  upgrading.value = true; upgradeError.value = ''
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { upgrading.value = false; return }

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-trainer-checkout`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({
        success_url: `${window.location.origin}/dashboard?upgraded=1`,
        cancel_url:  `${window.location.origin}/dashboard`,
      }),
    })
    const json = await res.json()
    if (!res.ok) { upgradeError.value = json.error ?? 'Checkout failed'; return }
    window.location.href = json.url
  } catch (err: any) {
    upgradeError.value = err.message
  } finally {
    upgrading.value = false
  }
}

async function handleSignOut() {
  await auth.signOut()
  router.push('/auth')
}
</script>

<style scoped>
.app-shell {
  display: flex; flex-direction: column;
  min-height: 100dvh; background: var(--bg); position: relative;
  padding-top: env(safe-area-inset-top, 0px);
}

/* Standalone trainer lockout */
.lockout {
  position: fixed; inset: 0; background: var(--bg);
  display: flex; align-items: center; justify-content: center;
  z-index: 999; padding: 1.5rem;
}
.lockout-card { text-align: center; max-width: 380px; padding: 2.5rem 1.5rem; border: 1px solid var(--surface); }
.lockout-icon  { font-size: 2.5rem; color: var(--danger); display: block; margin-bottom: 1.25rem; }
.lockout-title { font-family: 'Barlow Condensed', sans-serif; font-size: 1.5rem; font-weight: 900; color: var(--text); letter-spacing: 0.08em; margin-bottom: 0.75rem; }
.lockout-body  { font-size: 0.85rem; color: var(--sub); line-height: 1.5; margin-bottom: 1.75rem; }
.lockout-btn {
  display: inline-block; background: var(--accent); color: #fff; border: none;
  font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: 0.1em; font-size: 0.85rem;
  padding: 0.65rem 1.5rem; clip-path: var(--clip-sm); margin-bottom: 0.75rem; cursor: pointer;
}
.lockout-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.lockout-error { font-size: 0.78rem; color: var(--danger); margin: -0.4rem 0 0.75rem; }
.lockout-signout { display: block; margin: 0 auto; background: none; border: none; font-size: 0.78rem; color: var(--muted); cursor: pointer; }

/* Past-due / trial banners (standalone trainer) */
.warning-bar {
  flex-shrink: 0; background: rgba(255,107,107,0.1); border-bottom: 1px solid rgba(255,107,107,0.35);
  color: var(--danger); font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em;
  padding: 0.5rem 1rem; display: flex; align-items: center; gap: 0.5rem;
}
.warning-link { background: none; border: none; color: var(--danger); text-decoration: underline; margin-left: auto; font-family: inherit; font-size: inherit; font-weight: inherit; cursor: pointer; }
.trial-bar {
  flex-shrink: 0; background: rgba(74,158,255,0.08); border-bottom: 1px solid rgba(74,158,255,0.25);
  color: var(--accent); font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem; font-weight: 700; letter-spacing: 0.03em;
  padding: 0.5rem 1rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
}
.trial-link { background: none; border: none; color: var(--accent); text-decoration: underline; font-family: inherit; font-size: inherit; font-weight: inherit; cursor: pointer; }

.active-banner {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--accent); padding: 0.6rem 1.25rem;
  cursor: pointer; z-index: 100; flex-shrink: 0;
  transition: background 0.2s;
}
.active-banner:active { background: #3B8EEF; }
.banner-left  { display: flex; align-items: center; gap: 0.5rem; }
.banner-right { display: flex; align-items: center; gap: 0.75rem; }
.banner-dot   { width: 8px; height: 8px; background: #fff; border-radius: 50%; animation: pulse-dot 1.5s infinite; }
@keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
.banner-name  { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:0.9rem; letter-spacing:0.05em; color:#fff; }
.banner-timer { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:1rem; color:#fff; }
.banner-sets  { font-size:0.75rem; color:rgba(255,255,255,0.75); }
.banner-arrow { color:#fff; font-size:0.75rem; }

.app-main {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  padding-bottom: 5rem; /* space for bottom nav */
}
.app-main.has-banner { /* banner already accounted for */ }

.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s ease; }
.slide-down-enter-from, .slide-down-leave-to { transform: translateY(-100%); opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
