<template>
  <div class="set-row" :class="{ done: set.done, warmup: set.set_type === 'warmup', pr: isPR && set.done }">
    <!--
      .set-row-inner is wider than the container by DELETE_WIDTH (72px).
      The delete zone lives to the RIGHT of the row content, hidden by
      overflow:hidden on .set-row until the user swipes left.
      No z-index required — there is no overlap.
    -->
    <div
      class="set-row-inner"
      :style="innerStyle"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend.passive="onTouchEnd"
    >
      <!-- ── Row content (grid) ─────────────────────────────────────── -->
      <div class="row-content">
        <!-- Set type button — tap to cycle -->
        <button class="type-btn" @click="cycleType">{{ typeLabel }}</button>

        <!-- Previous performance -->
        <div class="prev-col">
          <template v-if="prev">
            <span class="prev-val prev-last">{{ prevDisplay }}</span>
            <span v-if="deltaDisplay" class="prev-val" :class="deltaClass">{{ deltaDisplay }}</span>
            <span v-if="prev.allTimeBest" class="prev-val prev-best">★ {{ bestDisplay }}</span>
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

        <!-- Done checkbox + PR badge -->
        <div class="done-wrap">
          <PRBadge v-if="isPR && set.done" class="pr-inline" />
          <button class="done-btn" :class="{ checked: set.done }" @click="toggleDone">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path v-if="set.done" d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- ── Delete zone (off-screen to the right at rest) ─────────── -->
      <div class="delete-zone" @click="onDeleteZoneClick">
        <i class="pi pi-trash" />
      </div>
    </div>

    <!-- ── Delete confirm dialog ────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showConfirm" class="delete-backdrop" @click.self="cancelDelete">
        <div class="delete-dialog">
          <div class="delete-dialog-title">Delete Set?</div>
          <div class="delete-dialog-sub">This action cannot be undone.</div>
          <div class="delete-dialog-actions">
            <button class="ddbtn cancel" @click="cancelDelete">CANCEL</button>
            <button class="ddbtn confirm" @click="confirmDeleteSet">DELETE</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ActiveSet } from '@/stores/workoutStore'
import type { PreviousPerformance } from '@/composables/usePreviousPerformance'
import { useUnits } from '@/composables/useUnits'
import PRBadge from '@/components/PRBadge.vue'

const props = defineProps<{
  set:           ActiveSet
  prev?:         PreviousPerformance | null
  isPR?:         boolean
  isBodyweight?: boolean
}>()
const emit = defineEmits<{
  update:     [Partial<ActiveSet>]
  delete:     []
  complete:   []
  uncomplete: []
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
  else emit('uncomplete')
}

// ─── Swipe-to-delete ─────────────────────────────────────────────────────────
// Swipe left past DELETE_THRESHOLD → snaps fully open → tap trash → confirm dialog.
const DELETE_WIDTH     = 72
const DELETE_THRESHOLD = 55

const swipeX      = ref(0)
const isDragging  = ref(false)
const showConfirm = ref(false)

function onDeleteZoneClick() {
  showConfirm.value = true
}

function cancelDelete() {
  showConfirm.value = false
  swipeX.value = 0
}

function confirmDeleteSet() {
  showConfirm.value = false
  swipeX.value = 0
  emit('delete')
}

let startX       = 0
let startY       = 0
let startSwipeX  = 0
let axisDecided  = false
let isHorizontal = false

const innerStyle = computed(() => ({
  transform:  `translateX(${swipeX.value}px)`,
  transition: isDragging.value ? 'none' : 'transform 0.2s ease',
}))

function onTouchStart(e: TouchEvent) {
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'BUTTON') return
  startX           = e.touches[0].clientX
  startY           = e.touches[0].clientY
  startSwipeX      = swipeX.value
  isDragging.value = true
  axisDecided      = false
  isHorizontal     = false
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) return
  const dx = e.touches[0].clientX - startX
  const dy = e.touches[0].clientY - startY

  if (!axisDecided && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
    axisDecided  = true
    isHorizontal = Math.abs(dx) >= Math.abs(dy)
  }

  if (!isHorizontal) return
  e.preventDefault()
  swipeX.value = Math.max(-DELETE_WIDTH, Math.min(0, startSwipeX + dx))
}

function onTouchEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  if (!isHorizontal) return

  if (swipeX.value < -DELETE_THRESHOLD) {
    swipeX.value = -DELETE_WIDTH  // snap open — user taps trash to confirm
  } else {
    swipeX.value = 0
  }
}
</script>

<style scoped>
/* Outer wrapper clips the wider inner so delete zone is hidden at rest */
.set-row {
  overflow: hidden;
  border-bottom: 1px solid var(--surface);
  transition: background 0.2s;
}
.set-row.done   { background: #162D1F; }
.set-row.warmup { opacity: 0.65; }
.set-row.pr     { background: rgba(255,180,0,0.06); }

/* Inner is wider than the container; flex puts row-content and delete-zone side by side */
.set-row-inner {
  display: flex;
  align-items: stretch;
  width: calc(100% + 72px);
  will-change: transform;
}

/*
 * row-content uses calc(100% - 72px) where 100% = set-row-inner's width = (container + 72px).
 * So row-content = container width exactly. Delete-zone starts at the container edge, off-screen.
 */
.row-content {
  flex: none;
  width: calc(100% - 72px);
  min-width: 0;
  display: grid;
  grid-template-columns: 28px 52px 1fr 1fr 36px;
  align-items: center;
  gap: 0.3rem;
  padding: 0.45rem 0;
  background: inherit;
}

/* Delete zone is fixed-width to the right of row-content, off-screen until swiped */
.delete-zone {
  flex: none;
  width: 72px;
  background: #3A0000;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FF4444;
  font-size: 1.1rem;
}

/* Type button */
.type-btn {
  background: var(--surface); border: 1px solid var(--border);
  color: #AEAEB2; font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700; font-size: 0.85rem;
  width: 28px; height: 28px;
  cursor: pointer; transition: border-color 0.15s;
}
.set-row.done .type-btn { border-color: rgba(52,199,89,0.3); color: #34C759; }

/* Previous */
.prev-col  { text-align: center; display: flex; flex-direction: column; gap: 1px; }
.prev-val  { font-size: 0.6rem; line-height: 1.2; }
.prev-last  { color: var(--sub); }
.prev-best  { color: rgba(255,180,0,0.6); }
.delta-up   { color: #34C759; }
.delta-down { color: var(--danger); }
.delta-same { color: #AEAEB2; }
.prev-empty { font-size: 0.62rem; color: var(--muted); }

/* Stepper */
.stepper { display: flex; align-items: center; gap: 0; position: relative; }
.step-val-wrap {
  flex: 1; min-width: 0; display: flex; align-items: center;
  background: var(--surface); border: 1px solid var(--border); border-left: none; border-right: none;
  height: 30px;
}
.step-val-wrap.bw { background: rgba(52,199,89,0.04); border-color: rgba(52,199,89,0.15); }
.bw-plus { color: #34C759; font-size: 0.75rem; font-weight: 700; padding-left: 0.3rem; flex-shrink: 0; }
.step-btn {
  background: var(--bg); border: 1px solid var(--border); color: var(--sub);
  font-size: 1rem; line-height: 1;
  width: 26px; height: 30px;
  cursor: pointer; flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
  display: flex; align-items: center; justify-content: center;
}
.step-btn:active { background: var(--border); color: var(--accent); }
.step-val {
  flex: 1; min-width: 0; width: 100%;
  background: transparent; border: none;
  color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 0.85rem; font-weight: 500;
  padding: 0.35rem 0.2rem; text-align: center; height: 30px;
}
.step-val:focus { outline: none; }
.step-val-wrap:focus-within { border-color: var(--accent); background: #2C2C2E; }
.set-row.done .step-val { color: #AEAEB2; }
.plate-btn {
  position: absolute; right: -18px;
  background: none; border: none;
  color: var(--sub); font-size: 0.7rem;
  cursor: pointer; padding: 0; line-height: 1;
}
.plate-btn:active { color: var(--accent); }

/* Done wrap + PR badge */
.done-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
.pr-inline { position: absolute; bottom: calc(100% + 2px); right: 0; white-space: nowrap; z-index: 1; }

.done-btn {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 2px solid var(--muted);
  background: none;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: transparent;
  transition: border-color 0.2s, background 0.2s, color 0.2s;
  flex-shrink: 0;
}
.done-btn.checked {
  border-color: #34C759;
  background: #34C759;
  color: #fff;
}

/* Delete confirm dialog */
.delete-backdrop {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0,0,0,0.75);
  display: flex; align-items: center; justify-content: center;
}
.delete-dialog {
  width: min(320px, 90vw);
  background: var(--bg); border: 1px solid #3A0000; border-top: 2px solid #FF4444;
  padding: 1.5rem;
}
.delete-dialog-title {
  font-family: 'Barlow Condensed',sans-serif; font-size: 1.2rem; font-weight: 900;
  color: var(--text); margin-bottom: 0.35rem;
}
.delete-dialog-sub {
  font-size: 0.78rem; color: var(--sub); margin-bottom: 1.25rem;
}
.delete-dialog-actions {
  display: flex; gap: 0.5rem;
}
.ddbtn {
  flex: 1; border: none; font-family: 'Barlow Condensed',sans-serif;
  font-weight: 700; font-size: 0.9rem; letter-spacing: 0.1em;
  padding: 0.7rem; cursor: pointer;
}
.ddbtn.cancel  { background: var(--surface); color: #AEAEB2; }
.ddbtn.confirm { background: #3A0000; color: #FF4444; border: 1px solid rgba(255,68,68,0.3); }
.ddbtn.confirm:active { background: #FF4444; color: #fff; }
</style>
