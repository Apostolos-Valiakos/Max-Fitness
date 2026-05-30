<template>
  <div class="app-shell">
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
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useWorkoutStore } from '@/stores/workoutStore'
import BottomNav from '@/components/BottomNav.vue'
import SyncStatusBar from '@/components/SyncStatusBar.vue'
import RestTimerPill from '@/components/RestTimerPill.vue'

const router  = useRouter()
const workout = useWorkoutStore()
</script>

<style scoped>
.app-shell {
  display: flex; flex-direction: column;
  min-height: 100dvh; background: #0A0A0A; position: relative;
  padding-top: env(safe-area-inset-top, 0px);
}

.active-banner {
  display: flex; align-items: center; justify-content: space-between;
  background: #FF4D00; padding: 0.6rem 1.25rem;
  cursor: pointer; z-index: 100; flex-shrink: 0;
  transition: background 0.2s;
}
.active-banner:active { background: #CC3D00; }
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
