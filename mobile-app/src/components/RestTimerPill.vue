<template>
  <Teleport to="body">
    <Transition name="pill-up">
      <div
        v-if="(timer.isRunning.value || timer.isFinished.value) && timer.isMinimized.value"
        class="rest-pill"
        @click="timer.expand()"
      >
        <!-- progress bar fills from left -->
        <div class="pill-progress" :style="{ width: timer.progress.value + '%' }" :class="{ finished: timer.isFinished.value }" />

        <span class="pill-label">REST</span>
        <span class="pill-time" :class="{ finished: timer.isFinished.value }">
          {{ timer.isFinished.value ? 'GO!' : timer.formatted.value }}
        </span>

        <button class="pill-skip" title="Stop timer" @click.stop="timer.skip()">✕</button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useRestTimer } from '@/composables/useRestTimer'
const timer = useRestTimer()
</script>

<style scoped>
.rest-pill {
  position: fixed;
  bottom: 4.5rem;       /* just above the bottom nav */
  left: 0.75rem;
  right: 0.75rem;
  z-index: 9998;

  display: flex;
  align-items: center;
  gap: 0.75rem;

  background: #252528;
  border: 1px solid #3A3A3C;
  padding: 0.7rem 1rem;
  cursor: pointer;
  overflow: hidden;

  clip-path: polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%);
}

/* live progress fill behind content */
.pill-progress {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  background: rgba(74, 158, 255, 0.12);
  transition: width 1s linear, background 0.3s;
  pointer-events: none;
}
.pill-progress.finished { background: rgba(52,199,89, 0.12); }

.pill-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em;
  color: #636366;
  flex-shrink: 0;
}

.pill-time {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.4rem; font-weight: 900;
  color: #4A9EFF;
  flex: 1;
  line-height: 1;
  transition: color 0.3s;
}
.pill-time.finished { color: #34C759; }

.pill-skip {
  background: none; border: none;
  color: #8E8E93; font-size: 0.85rem;
  cursor: pointer; padding: 0.25rem 0.5rem;
  flex-shrink: 0;
  transition: color 0.15s;
  line-height: 1;
}
.pill-skip:active { color: #AEAEB2; }

.pill-up-enter-active, .pill-up-leave-active { transition: all 0.25s ease; }
.pill-up-enter-from, .pill-up-leave-to { opacity: 0; transform: translateY(1rem); }
</style>
