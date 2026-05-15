<template>
  <div class="rest-inline" :class="{ finished: timer.isFinished.value }">
    <!-- Progress bar track -->
    <div class="bar-track">
      <div class="bar-fill" :style="{ width: `${timer.progress.value}%` }" />
    </div>

    <div class="row">
      <button class="adj-btn" @click="timer.addTime(-15)">−15s</button>

      <div class="center">
        <span class="rest-label">REST</span>
        <span class="rest-time">{{ timer.isFinished.value ? 'GO!' : timer.formatted.value }}</span>
      </div>

      <button class="adj-btn" @click="timer.addTime(15)">+15s</button>
      <button class="skip-btn" @click="timer.skip()">Skip</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRestTimer } from '@/composables/useRestTimer'

const timer = useRestTimer()
</script>

<style scoped>
.rest-inline {
  width: 100%;
  background: #111;
  border-top: 1px solid #1E1E1E;
  border-bottom: 1px solid #1E1E1E;
  overflow: hidden;
  transition: background 0.3s;
}
.rest-inline.finished {
  background: rgba(0, 200, 81, 0.08);
}

.bar-track {
  width: 100%;
  height: 3px;
  background: #1A1A1A;
}
.bar-fill {
  height: 100%;
  background: #FF4D00;
  transition: width 1s linear;
}
.rest-inline.finished .bar-fill {
  background: #00C851;
  width: 100% !important;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 0.75rem;
  gap: 0.5rem;
}

.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.rest-label {
  font-size: 0.5rem;
  letter-spacing: 0.12em;
  color: #555;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
}
.rest-time {
  font-size: 1.35rem;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  color: #F0F0F0;
  letter-spacing: 0.04em;
  line-height: 1;
}
.rest-inline.finished .rest-time {
  color: #00C851;
}

.adj-btn {
  background: #1A1A1A;
  border: 1px solid #2A2A2A;
  color: #888;
  font-size: 0.7rem;
  font-family: 'DM Sans', sans-serif;
  padding: 0.3rem 0.5rem;
  cursor: pointer;
  transition: color 0.15s;
  flex-shrink: 0;
}
.adj-btn:active { color: #FF4D00; }

.skip-btn {
  background: none;
  border: none;
  color: #555;
  font-size: 0.7rem;
  font-family: 'DM Sans', sans-serif;
  cursor: pointer;
  padding: 0.3rem 0.25rem;
  flex-shrink: 0;
}
.skip-btn:active { color: #FF4D00; }
</style>
