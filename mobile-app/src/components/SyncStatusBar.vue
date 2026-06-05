<template>
  <Transition name="slide">
    <div v-if="syncStatus !== 'idle'" class="sync-bar" :class="syncStatus">
      <i :class="iconClass" />
      <span class="sync-label">{{ label }}</span>
      <button v-if="syncStatus === 'error'" class="retry-btn" @click="retrySync">RETRY</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { syncStatus, retrySync } from '@/lib/rxdb/syncManager'

const label = computed(() => {
  if (syncStatus.value === 'syncing') return 'Syncing...'
  if (syncStatus.value === 'offline') return 'Offline — changes saved locally'
  if (syncStatus.value === 'error')   return 'Sync error'
  return ''
})

const iconClass = computed(() => {
  if (syncStatus.value === 'syncing') return 'pi pi-spin pi-spinner'
  if (syncStatus.value === 'offline') return 'pi pi-wifi-off'
  if (syncStatus.value === 'error')   return 'pi pi-exclamation-triangle'
  return ''
})
</script>

<style scoped>
.sync-bar {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.3rem 1rem; font-size: 0.72rem;
  font-family: 'DM Sans', sans-serif;
}
.sync-bar.syncing { background: #252528; color: #AEAEB2; }
.sync-bar.offline { background: #1A1200; color: #FFB800; }
.sync-bar.error   { background: #1A0000; color: #4A9EFF; }
.sync-label { flex: 1; }
.retry-btn {
  background: none; border: 1px solid rgba(74,158,255,0.4); color: #4A9EFF;
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700;
  letter-spacing: 0.1em; padding: 0.1rem 0.5rem; cursor: pointer;
}
.retry-btn:active { background: rgba(74,158,255,0.1); border-color: #4A9EFF; }
.slide-enter-active, .slide-leave-active { transition: all 0.2s; }
.slide-enter-from, .slide-leave-to { transform: translateY(-100%); opacity: 0; }
</style>
