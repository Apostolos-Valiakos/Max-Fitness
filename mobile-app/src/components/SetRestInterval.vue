<template>
  <!-- Active countdown: delegate to existing RestTimerInline -->
  <RestTimerInline v-if="isActive" />

  <!-- At-rest: always-visible label between sets, tap to edit -->
  <div v-else class="rest-gap" @click="showPresets = !showPresets">
    <!-- Preset picker -->
    <div v-if="showPresets" class="preset-row" @click.stop>
      <button
        v-for="s in PRESETS"
        :key="s"
        class="preset-btn"
        :class="{ active: restSecs === s }"
        @click.stop="select(s)"
      >{{ fmt(s) }}</button>
      <button class="preset-close" @click.stop="showPresets = false">✕</button>
    </div>

    <!-- Static label -->
    <template v-else>
      <div class="gap-line" />
      <span class="gap-time">{{ fmt(restSecs) }}</span>
      <div class="gap-line" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRestTimer } from '@/composables/useRestTimer'
import RestTimerInline from '@/components/RestTimerInline.vue'

const props = defineProps<{
  setId: string
  restSecs: number
}>()

const emit = defineEmits<{
  (e: 'update-rest', seconds: number): void
}>()

const timer       = useRestTimer()
const showPresets = ref(false)

const isActive = computed(() =>
  timer.activeSetId.value === props.setId &&
  (timer.isRunning.value || timer.isFinished.value)
)

const PRESETS = [30, 60, 90, 120, 180, 240, 300]

function fmt(s: number): string {
  const m   = Math.floor(s / 60)
  const sec = s % 60
  if (m === 0) return `${sec}s`
  return sec === 0 ? `${m}m` : `${m}:${String(sec).padStart(2, '0')}`
}

function select(s: number) {
  emit('update-rest', s)
  showPresets.value = false
}
</script>

<style scoped>
.rest-gap {
  display: flex;
  align-items: center;
  min-height: 26px;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.gap-line {
  flex: 1;
  height: 1px;
  background: var(--surface);
}
.gap-time {
  font-size: 0.6rem;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.1em;
  padding: 0 0.65rem;
  transition: color 0.15s;
}
.rest-gap:active .gap-time { color: var(--accent); }

.preset-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.75rem;
  width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}
.preset-row::-webkit-scrollbar { display: none; }

.preset-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  color: #AEAEB2;
  font-size: 0.65rem;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.3rem 0.55rem;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.preset-btn.active  { border-color: var(--accent); color: var(--accent); }
.preset-btn:active  { background: rgba(74,158,255,0.08); }

.preset-close {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 0.65rem;
  font-family: 'DM Sans', sans-serif;
  cursor: pointer;
  padding: 0.3rem 0.4rem;
  margin-left: auto;
  flex-shrink: 0;
  transition: color 0.15s;
}
.preset-close:active { color: var(--accent); }
</style>
