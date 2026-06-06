<template>
  <Teleport to="body">
    <Transition name="timer-in">
      <div
        v-if="
          (timer.isRunning.value || timer.isFinished.value) &&
          !timer.isMinimized.value
        "
        class="timer-overlay"
        @click.self="timer.minimize()"
      >
        <div class="timer-card">
          <!-- Top row: minimize (–) left, dismiss (✕) right -->
          <div class="timer-top-row">
            <button class="icon-btn" title="Minimize" @click="timer.minimize()">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect
                  x="2"
                  y="7"
                  width="12"
                  height="2"
                  rx="1"
                  fill="currentColor"
                />
              </svg>
            </button>
            <div class="timer-label">REST</div>
            <button
              class="icon-btn dismiss-btn"
              title="Stop timer"
              @click="timer.skip()"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1 1l12 12M13 1L1 13"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>

          <div class="timer-ring-wrap">
            <svg class="timer-ring" viewBox="0 0 120 120">
              <circle class="ring-bg" cx="60" cy="60" r="52" />
              <circle
                class="ring-fill"
                cx="60"
                cy="60"
                r="52"
                :style="{ strokeDashoffset: dashOffset }"
                :class="{ finished: timer.isFinished.value }"
              />
            </svg>
            <div
              class="timer-time"
              :class="{ finished: timer.isFinished.value }"
            >
              {{ timer.isFinished.value ? "GO!" : timer.formatted.value }}
            </div>
          </div>

          <div class="timer-actions">
            <button class="t-btn" @click="timer.addTime(-15)">−15s</button>
            <button class="t-btn skip" @click="timer.skip()">Skip</button>
            <button class="t-btn" @click="timer.addTime(15)">+15s</button>
          </div>

          <div class="timer-presets">
            <button
              v-for="s in [60, 90, 120, 180]"
              :key="s"
              class="preset-btn"
              @click="timer.start(s)"
            >
              {{ s }}s
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRestTimer } from "@/composables/useRestTimer";

const timer = useRestTimer();
const CIRCUMFERENCE = 2 * Math.PI * 52;
const dashOffset = computed(
  () => (1 - timer.progress.value / 100) * CIRCUMFERENCE,
);
</script>

<style scoped>
.timer-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.timer-card {
  background: #1c1c1e;
  border: 1px solid #3a3a3c;
  padding: 1.25rem 2rem 2rem;
  text-align: center;
  width: 280px;
  clip-path: polygon(
    0 0,
    100% 0,
    100% calc(100% - 20px),
    calc(100% - 20px) 100%,
    0 100%
  );
}
.timer-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}
.timer-label {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: var(--muted);
}
.icon-btn {
  background: none;
  border: none;
  color: #8e8e93;
  cursor: pointer;
  padding: 0.35rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
}
.icon-btn:active {
  color: #4a9eff;
}
.dismiss-btn:active {
  color: #aeaeb2;
}

.timer-ring-wrap {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 1.5rem;
}
.timer-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.ring-bg {
  fill: none;
  stroke: var(--surface);
  stroke-width: 8;
}
.ring-fill {
  fill: none;
  stroke: #4a9eff;
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 326.7;
  transition:
    stroke-dashoffset 1s linear,
    stroke 0.3s;
}
.ring-fill.finished {
  stroke: #34c759;
}
.timer-time {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Barlow Condensed", sans-serif;
  font-size: 2rem;
  font-weight: 900;
  color: #f0f0f0;
}
.timer-time.finished {
  color: #34c759;
  font-size: 2.5rem;
}

.timer-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-bottom: 1rem;
}
.t-btn {
  background: var(--surface);
  border: 1px solid #3a3a3c;
  color: #aeaeb2;
  font-family: "Barlow Condensed", sans-serif;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  transition: all 0.15s;
}
.t-btn:active {
  background: #3a3a3c;
}
.t-btn.skip {
  color: #4a9eff;
  border-color: rgba(74, 158, 255, 0.3);
}

.timer-presets {
  display: flex;
  gap: 0.4rem;
  justify-content: center;
}
.preset-btn {
  background: none;
  border: 1px solid var(--surface);
  color: var(--muted);
  font-size: 0.72rem;
  padding: 0.3rem 0.5rem;
  cursor: pointer;
  font-family: "DM Sans", sans-serif;
  transition: all 0.15s;
}
.preset-btn:active {
  border-color: #4a9eff;
  color: #4a9eff;
}

.timer-in-enter-active,
.timer-in-leave-active {
  transition: all 0.25s ease;
}
.timer-in-enter-from,
.timer-in-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
