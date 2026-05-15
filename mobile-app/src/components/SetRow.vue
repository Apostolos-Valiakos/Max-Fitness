<template>
  <div class="set-row" :class="{ done: set.done, warmup: set.set_type === 'warmup', pr: isPR && set.done }">
    <!-- Set type button — tap to cycle -->
    <button class="type-btn" @click="cycleType">{{ typeLabel }}</button>

    <!-- Previous performance -->
    <div class="prev-col">
      <template v-if="prev">
        <span class="prev-val prev-last">{{ prevDisplay }}</span>
        <span v-if="deltaDisplay" class="prev-val" :class="deltaClass">{{ deltaDisplay }}</span>
        <span v-if="prev.allTimeBest" class="prev-val prev-best">
          ★ {{ bestDisplay }}
        </span>
      </template>
      <span v-else class="prev-empty">—</span>
    </div>

    <!-- Weight stepper -->
    <div class="stepper">
      <button class="step-btn" @click="adjustWeight(-units.weightStep.value)">−</button>
      <div class="step-val-wrap" :class="{ bw: isBodyweight }">
        <span v-if="isBodyweight" class="bw-plus">+</span>
        <input
          class="step-val"
          type="number"
          inputmode="decimal"
          :placeholder="isBodyweight ? 'added' : ''"
          :value="displayedWeight"
          @change="onWeightChange"
          @focus="($event.target as HTMLInputElement).select()"
        />
      </div>
      <button class="step-btn" @click="adjustWeight(units.weightStep.value)">+</button>
      <button v-if="set.weight_kg" class="plate-btn" @click="emit('openPlates', set.weight_kg!)">⚖</button>
    </div>

    <!-- Reps stepper -->
    <div class="stepper">
      <button class="step-btn" @click="adjustReps(-1)">−</button>
      <input
        class="step-val"
        type="number"
        inputmode="numeric"
        :value="set.reps ?? ''"
        @change="onRepsChange"
        @focus="($event.target as HTMLInputElement).select()"
      />
      <button class="step-btn" @click="adjustReps(1)">+</button>
    </div>

    <!-- Done checkbox + PR badge overlay -->
    <div class="done-wrap">
      <PRBadge v-if="isPR && set.done" class="pr-inline" />
      <button class="done-btn" :class="{ checked: set.done }" @click="toggleDone">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path v-if="set.done" d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActiveSet } from '@/stores/workoutStore'
import type { PreviousPerformance } from '@/composables/usePreviousPerformance'
import { useUnits } from '@/composables/useUnits'
import PRBadge from '@/components/PRBadge.vue'

const props = defineProps<{
  set:          ActiveSet
  prev?:        PreviousPerformance | null
  isPR?:        boolean
  isBodyweight?: boolean
}>()
const emit  = defineEmits<{
  update:     [Partial<ActiveSet>]
  delete:     []
  complete:   []
  openPlates: [number]
}>()

const units = useUnits()

const TYPE_CYCLE: ActiveSet['set_type'][] = ['working', 'warmup', 'failure', 'drop', 'myorep']

const typeLabel = computed(() => {
  if (props.set.set_type === 'working') return String(props.set.set_number)
  const labels: Record<string, string> = { warmup: 'W', failure: 'F', drop: 'D', myorep: 'M' }
  return labels[props.set.set_type] ?? props.set.set_type[0].toUpperCase()
})

const displayedWeight = computed(() => {
  if (props.set.weight_kg == null) return ''
  return units.toDisplay(props.set.weight_kg) ?? ''
})

const prevDisplay = computed(() => {
  if (!props.prev) return ''
  const w = units.toDisplay(props.prev.weight_kg)
  return `${w ?? '—'} × ${props.prev.reps ?? '—'}`
})

const weightDelta = computed<number | null>(() => {
  if (!props.prev || props.set.weight_kg == null || props.prev.weight_kg == null) return null
  const curr = units.toDisplay(props.set.weight_kg) ?? 0
  const prev = units.toDisplay(props.prev.weight_kg) ?? 0
  return parseFloat((curr - prev).toFixed(2))
})

const deltaDisplay = computed(() => {
  const d = weightDelta.value
  if (d === null) return ''
  return d > 0 ? `+${d}` : `${d}`
})

const deltaClass = computed(() => {
  const d = weightDelta.value
  if (d === null) return ''
  if (d > 0) return 'delta-up'
  if (d < 0) return 'delta-down'
  return 'delta-same'
})

const bestDisplay = computed(() => {
  const b = props.prev?.allTimeBest
  if (!b) return ''
  const w = units.toDisplay(b.weight_kg)
  return `${w ?? '—'} × ${b.reps}`
})

function cycleType() {
  const idx  = TYPE_CYCLE.indexOf(props.set.set_type)
  const next = TYPE_CYCLE[(idx + 1) % TYPE_CYCLE.length]
  emit('update', { set_type: next })
}

function adjustWeight(delta: number) {
  const current = units.toDisplay(props.set.weight_kg) ?? 0
  const next    = Math.max(0, parseFloat((current + delta).toFixed(2)))
  emit('update', { weight_kg: units.toKg(next) })
}

function onWeightChange(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(v)) emit('update', { weight_kg: units.toKg(Math.max(0, v)) })
}

function adjustReps(delta: number) {
  const current = props.set.reps ?? 0
  emit('update', { reps: Math.max(0, current + delta) })
}

function onRepsChange(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value)
  if (!isNaN(v)) emit('update', { reps: Math.max(0, v) })
}

function toggleDone() {
  const nowDone = !props.set.done
  emit('update', { done: nowDone })
  if (nowDone) emit('complete')
}
</script>

<style scoped>
.set-row {
  display: grid;
  grid-template-columns: 28px 52px 1fr 1fr 36px;
  align-items: center;
  gap: 0.3rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid #1A1A1A;
  transition: background 0.2s;
}
.set-row.done   { background: rgba(0, 200, 81, 0.05); }
.set-row.warmup { opacity: 0.65; }
.set-row.pr     { background: rgba(255,180,0,0.06); }

/* Type button */
.type-btn {
  background: #1A1A1A; border: 1px solid #2A2A2A;
  color: #888; font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700; font-size: 0.85rem;
  width: 28px; height: 28px;
  cursor: pointer; transition: border-color 0.15s;
}
.set-row.done .type-btn { border-color: rgba(0,200,81,0.3); color: #00C851; }

/* Previous */
.prev-col { text-align: center; display: flex; flex-direction: column; gap: 1px; }
.prev-val  { font-size: 0.6rem; line-height: 1.2; }
.prev-last  { color: #444; }
.prev-best  { color: rgba(255,180,0,0.5); }
.delta-up   { color: #00C851; }
.delta-down { color: #FF4D00; }
.delta-same { color: #555; }
.prev-empty { font-size: 0.62rem; color: #2A2A2A; }

/* Stepper */
.stepper {
  display: flex; align-items: center; gap: 0; position: relative;
}
.step-val-wrap {
  flex: 1; min-width: 0; display: flex; align-items: center;
  background: #1A1A1A; border: 1px solid #2A2A2A; border-left: none; border-right: none;
  height: 30px;
}
.step-val-wrap.bw { background: rgba(0,200,81,0.04); border-color: rgba(0,200,81,0.15); }
.bw-plus { color: #00C851; font-size: 0.75rem; font-weight: 700; padding-left: 0.3rem; flex-shrink: 0; }
.step-btn {
  background: #111; border: 1px solid #2A2A2A; color: #666;
  font-size: 1rem; line-height: 1;
  width: 26px; height: 30px;
  cursor: pointer; flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
  display: flex; align-items: center; justify-content: center;
}
.step-btn:active { background: #2A2A2A; color: #FF4D00; }
.step-val {
  flex: 1; min-width: 0; width: 100%;
  background: transparent; border: none;
  color: #F0F0F0; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; font-weight: 500;
  padding: 0.35rem 0.2rem; text-align: center; height: 30px;
}
.step-val:focus { outline: none; }
.step-val-wrap:focus-within { border-color: #FF4D00; background: #222; }
.set-row.done .step-val { color: #aaa; }
.plate-btn {
  position: absolute; right: -18px;
  background: none; border: none;
  color: #333; font-size: 0.7rem;
  cursor: pointer; padding: 0; line-height: 1;
}
.plate-btn:active { color: #FF4D00; }

/* Done wrap + PR badge */
.done-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
.pr-inline { position: absolute; bottom: calc(100% + 2px); right: 0; white-space: nowrap; z-index: 1; }

.done-btn {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 2px solid #333;
  background: none;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: transparent;
  transition: border-color 0.2s, background 0.2s, color 0.2s;
  flex-shrink: 0;
}
.done-btn.checked {
  border-color: #00C851;
  background: rgba(0, 200, 81, 0.15);
  color: #00C851;
}
</style>
