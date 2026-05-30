<template>
  <div class="dark">
    <div v-if="auth.isOffline" class="offline-banner">
      <i class="pi pi-wifi" style="text-decoration: line-through" /> Offline mode — data will sync when connected
    </div>
    <router-view />
    <Toast position="top-center" group="global" />
  </div>
</template>

<script setup lang="ts">
import Toast from 'primevue/toast'
import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useRestTimer } from '@/composables/useRestTimer'

const auth      = useAuthStore()
const restTimer = useRestTimer()

// Resync rest timer after app comes back from background (browser tab or native)
function onVisibilityChange() {
  if (document.visibilityState === 'visible') restTimer.resync()
}

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  // Capacitor native foreground event
  try {
    const { App } = await import('@capacitor/app')
    App.addListener('appStateChange', ({ isActive }) => { if (isActive) restTimer.resync() })
  } catch {}
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style>
@import './assets/main.css';
.dark { height: 100%; }
</style>

<style scoped>
.offline-banner {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 9999;
  background: #1a1a1a;
  border-bottom: 1px solid #333;
  color: #888;
  font-size: 0.72rem;
  font-family: 'DM Sans', sans-serif;
  letter-spacing: 0.03em;
  padding: 0.4rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
}
</style>
