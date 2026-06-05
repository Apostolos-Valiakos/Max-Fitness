<template>
  <div class="stat-card">
    <div class="stat-icon"><i :class="icon" /></div>
    <div class="stat-body">
      <div class="stat-value">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
    <div v-if="trend !== undefined" class="stat-trend" :class="trend >= 0 ? 'up' : 'down'">
      <i :class="trend >= 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'" />
      {{ Math.abs(trend) }}%
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ icon: string; value: string | number; label: string; trend?: number }>()
</script>

<style scoped>
.stat-card {
  background: #1C1C1E; border: 1px solid #252528; padding: 1.25rem;
  display: flex; align-items: center; gap: 1rem;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%);
}
.stat-icon { width: 40px; height: 40px; background: rgba(74,158,255,0.1); display: flex; align-items: center; justify-content: center; color: #4A9EFF; font-size: 1.1rem; flex-shrink: 0; }
.stat-body { flex: 1; }
.stat-value { font-family: 'Barlow Condensed', sans-serif; font-size: 1.8rem; font-weight: 800; color: #F0F0F0; line-height: 1; }
.stat-label { font-size: 0.7rem; color: #8E8E93; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.2rem; }
.stat-trend { font-size: 0.75rem; font-weight: 600; }
.stat-trend.up { color: #34C759; }
.stat-trend.down { color: #4A9EFF; }
</style>
