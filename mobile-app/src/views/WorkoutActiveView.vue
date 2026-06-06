<template>
  <div class="view">
    <!-- Header -->
    <div class="workout-header">
      <div class="header-left">
        <div v-if="!renamingSession" class="session-name" @click="startRename">{{ workout.activeSession?.name }}</div>
        <input
          v-else
          ref="renameInputEl"
          class="session-name-input"
          v-model="renameValue"
          @blur="saveRename"
          @keydown.enter.prevent="saveRename"
          @keydown.escape="renamingSession = false"
        />
        <div v-if="currentExercise" class="header-progress">
          <span class="prog-name">{{ currentExercise.exerciseName }}</span>
          <span class="prog-sep"> · </span>
          <span class="prog-sets">{{ currentExercise.sets.filter(s => s.done).length }}/{{ currentExercise.sets.length }}</span>
        </div>
        <div v-else class="session-timer">{{ workout.elapsedFormatted }}</div>
      </div>
      <div class="header-right">
        <div class="header-stats">
          <span class="header-timer" v-if="currentExercise">{{ workout.elapsedFormatted }}</span>
          <span class="header-vol">{{ Math.round(workout.totalVolume).toLocaleString() }} {{ units.label.value }}</span>
        </div>
        <button class="finish-btn" @click="confirmFinish = true">FINISH</button>
      </div>
    </div>

    <!-- Exercise list -->
    <div class="exercise-list">
      <div
        v-for="ex in workout.activeExercises"
        :key="ex.exerciseId"
        class="exercise-block"
      >
        <!-- Exercise header -->
        <div class="ex-header">
          <div class="ex-name" @click="openInfo(ex.exerciseId)">{{ ex.exerciseName }}</div>
          <div class="ex-actions">
            <button class="ex-dots-btn" @click="contextMenuFor = ex.exerciseId" title="Options">
              <i class="pi pi-ellipsis-v" />
            </button>
          </div>
        </div>

        <!-- Template guidance hint -->
        <div v-if="ex.targetReps || ex.templateNotes" class="ex-hint">
          <span v-if="ex.targetSets && ex.targetReps" class="ex-target">
            TARGET · {{ ex.targetSets }}×{{ ex.targetReps }}
          </span>
          <span v-if="ex.templateNotes" class="ex-note-hint">{{ ex.templateNotes }}</span>
        </div>

        <!-- Sticky note banner -->
        <div v-if="stickyNoteMap.get(ex.exerciseId)" class="sticky-note-banner">
          <i class="pi pi-bookmark-fill" />
          {{ stickyNoteMap.get(ex.exerciseId) }}
        </div>

        <!-- Set column headers — matches SetRow grid: 28px 52px 1fr 1fr 36px -->
        <div class="set-headers">
          <span>SET</span>
          <span>PREV</span>
          <span>WEIGHT</span>
          <span>REPS</span>
          <span></span>
        </div>

        <!-- Sets with per-set rest interval -->
        <template v-for="set in ex.sets" :key="set.id">
          <SetRow
            :set="set"
            :prev="prevPerformance[ex.exerciseId]"
            :isPR="set.isPR"
            :isBodyweight="bodyweightIds.has(ex.exerciseId)"
            @update="(u) => workout.updateSet(set.id, u)"
            @delete="handleDeleteSet(set.id)"
            @complete="handleSetComplete(ex.exerciseId, set)"
            @uncomplete="handleSetUncomplete(set.id)"
            @openPlates="(kg) => openPlates(kg)"
          />
          <SetRestInterval
            :setId="set.id"
            :restSecs="resolveSetRest(ex, set)"
            @update-rest="(s) => workout.updateSetRest(set.id, s)"
          />
        </template>

        <!-- Add set -->
        <button class="add-set-btn" @click="handleAddSet(ex.exerciseId, ex.exerciseName)">
          <i class="pi pi-plus" /> ADD SET
        </button>

        <!-- Per-exercise notes -->
        <textarea
          class="ex-notes-ta"
          rows="2"
          placeholder="Exercise notes..."
          :value="ex.exerciseNotes"
          @input="workout.updateExerciseNotes(ex.exerciseId, ($event.target as HTMLTextAreaElement).value)"
        />
      </div>
    </div>

    <!-- Add exercise -->
    <button class="add-exercise-btn" @click="router.push('/workout/exercise-picker')">
      <i class="pi pi-plus" />
      ADD EXERCISE
    </button>

    <!-- Exercise info sheet -->
    <ExerciseInfoSheet
      :visible="infoSheetFor !== null"
      :exerciseId="infoSheetFor"
      @close="infoSheetFor = null"
    />

    <!-- Plate calculator -->
    <PlateCalculatorModal
      :visible="platesVisible"
      :weight-kg="platesWeightKg"
      @close="platesVisible = false"
    />

    <!-- Rest time settings sheet -->
    <div v-if="restSettingsFor" class="rest-backdrop" @click.self="restSettingsFor = null">
      <div class="rest-sheet">
        <div class="rest-sheet-title">REST TIME</div>

        <!-- Default for this exercise -->
        <div class="rest-sub">DEFAULT</div>
        <div class="rest-presets">
          <button
            v-for="s in REST_PRESETS" :key="s"
            class="rest-preset"
            :class="{ active: exSettings.getRestTime(restSettingsFor) === s }"
            @click="setRest(restSettingsFor, s)"
          >{{ formatRestLabel(s) }}</button>
        </div>

        <!-- Per set type -->
        <div class="rest-sub" style="margin-top:0.75rem">BY SET TYPE</div>
        <div v-for="st in REST_SET_TYPES" :key="st.type" class="rest-type-row">
          <span class="rest-type-label">{{ st.label }}</span>
          <div class="rest-presets rest-presets-sm">
            <button
              v-for="s in REST_PRESETS" :key="s"
              class="rest-preset"
              :class="{ active: exSettings.getRestTime(restSettingsFor, st.type) === s }"
              @click="setRest(restSettingsFor, s, st.type)"
            >{{ formatRestLabel(s) }}</button>
          </div>
        </div>

        <button class="rest-done" @click="restSettingsFor = null">Done</button>
      </div>
    </div>

    <!-- Exercise context menu -->
    <div v-if="contextMenuFor" class="ctx-backdrop" @click.self="contextMenuFor = null">
      <div class="ctx-sheet">
        <div class="ctx-handle" @click="contextMenuFor = null" />
        <div class="ctx-title">{{ workout.activeExercises.find(e => e.exerciseId === contextMenuFor)?.exerciseName }}</div>
        <button class="ctx-item" @click="ctxInfo">
          <i class="pi pi-info-circle ctx-icon" /> Exercise info
        </button>
        <button
          v-if="workout.activeExercises.find(e => e.exerciseId === contextMenuFor)?.sets.some(s => s.set_type === 'working' && s.weight_kg)"
          class="ctx-item"
          @click="ctxWarmup"
        >
          <i class="pi pi-sun ctx-icon" /> Add warm-up sets
        </button>
        <button class="ctx-item" @click="ctxNote">
          <i class="pi pi-pencil ctx-icon" /> Add note
        </button>
        <button class="ctx-item" @click="ctxRest">
          <i class="pi pi-clock ctx-icon" /> Update rest timers
        </button>
        <button class="ctx-item" @click="ctxReplace">
          <i class="pi pi-sync ctx-icon" /> Replace exercise
        </button>
        <div class="ctx-divider" />
        <button class="ctx-item ctx-danger" @click="ctxRemove">
          <i class="pi pi-times ctx-icon" /> Remove exercise
        </button>
      </div>
    </div>

    <!-- Finish confirm modal -->
    <div v-if="confirmFinish" class="modal-backdrop" @click.self="confirmFinish = false">
      <div class="modal-box">
        <div class="modal-header">
          <div class="modal-title">Finish Workout?</div>
          <button class="modal-close" @click="confirmFinish = false"><i class="pi pi-times" /></button>
        </div>
        <div class="dialog-body">
          <div class="dialog-stat"><span>Duration</span><strong>{{ workout.elapsedFormatted }}</strong></div>
          <div class="dialog-stat"><span>Exercises</span><strong>{{ workout.activeExercises.length }}</strong></div>
          <div class="dialog-stat"><span>Sets</span><strong>{{ workout.totalSets }}</strong></div>
          <div class="dialog-stat"><span>Volume</span><strong>{{ Math.round(workout.totalVolume).toLocaleString() }} {{ units.label.value }}</strong></div>
          <textarea v-model="sessionNotes" class="notes-input" placeholder="Add a note (optional)..." rows="3" />
        </div>
        <div class="dialog-actions">
          <button class="dialog-btn discard" @click="startDiscard">Discard</button>
          <button class="dialog-btn cancel" @click="confirmFinish = false">Continue</button>
          <button class="dialog-btn finish" @click="handleFinish">Save</button>
        </div>
      </div>
    </div>

    <!-- Discard confirm modal -->
    <div v-if="confirmDiscard" class="modal-backdrop" @click.self="confirmDiscard = false">
      <div class="modal-box">
        <div class="modal-header">
          <div class="modal-title">Discard Workout?</div>
          <button class="modal-close" @click="confirmDiscard = false"><i class="pi pi-times" /></button>
        </div>
        <p class="modal-sub">All sets will be lost. This cannot be undone.</p>
        <div class="dialog-actions">
          <button class="dialog-btn cancel" @click="confirmDiscard = false">Keep it</button>
          <button class="dialog-btn discard-confirm" @click="handleDiscard">Discard</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkoutStore }          from '@/stores/workoutStore'
import type { ActiveSet }           from '@/stores/workoutStore'
import { useExerciseStore }         from '@/stores/exerciseStore'
import { useRestTimer }             from '@/composables/useRestTimer'
import { useExerciseSettings }      from '@/composables/useExerciseSettings'
import { useUnits }                 from '@/composables/useUnits'
import { getPreviousPerformance, type PreviousPerformance } from '@/composables/usePreviousPerformance'
import { checkIsNewPR }             from '@/composables/usePersonalRecords'
import SetRow               from '@/components/SetRow.vue'
import SetRestInterval      from '@/components/SetRestInterval.vue'
import type { ActiveExercise } from '@/stores/workoutStore'
import PlateCalculatorModal from '@/components/PlateCalculatorModal.vue'
import ExerciseInfoSheet    from '@/components/ExerciseInfoSheet.vue'

const router        = useRouter()
const workout       = useWorkoutStore()
const exerciseStore = useExerciseStore()
const restTimer     = useRestTimer()
const exSettings    = useExerciseSettings()
const units         = useUnits()

const renamingSession = ref(false)
const renameValue     = ref('')
const renameInputEl   = ref<HTMLInputElement | null>(null)

async function startRename() {
  renameValue.value    = workout.activeSession?.name ?? ''
  renamingSession.value = true
  await nextTick()
  renameInputEl.value?.select()
}

async function saveRename() {
  renamingSession.value = false
  if (renameValue.value.trim()) await workout.renameSession(renameValue.value)
}

const confirmFinish   = ref(false)
const confirmDiscard  = ref(false)
const sessionNotes    = ref('')
const prevPerformance = ref<Record<string, PreviousPerformance | null>>({})

// Inline rest timer — activeSetId lives in the singleton so it survives remounts
watch(() => restTimer.isFinished.value, finished => {
  if (finished) setTimeout(() => { restTimer.setActive(null) }, 2000)
})

// Header progress tracking
const currentExerciseId = ref<string | null>(null)
const currentExercise = computed(() =>
  currentExerciseId.value
    ? workout.activeExercises.find(e => e.exerciseId === currentExerciseId.value)
    : null
)

// Sticky notes map from exercise library
const stickyNoteMap = computed(() =>
  new Map(exerciseStore.exercises.map(e => [e.id, e.sticky_note]))
)

// Bodyweight exercise detection
const bodyweightIds = computed(() =>
  new Set(exerciseStore.exercises.filter(e => e.equipment === 'bodyweight').map(e => e.id))
)

// Plate calculator
const platesVisible  = ref(false)
const platesWeightKg = ref(0)

// Rest settings sheet
const restSettingsFor = ref<string | null>(null)

// Exercise info sheet
const infoSheetFor = ref<string | null>(null)
function openInfo(exerciseId: string) {
  infoSheetFor.value = exerciseId
}

function openReplace(exerciseId: string) {
  router.push({ path: '/workout/exercise-picker', query: { replaceId: exerciseId } })
}

// Exercise context menu
const contextMenuFor = ref<string | null>(null)

function ctxInfo() {
  const id = contextMenuFor.value!
  contextMenuFor.value = null
  openInfo(id)
}
function ctxWarmup() {
  const id = contextMenuFor.value!
  contextMenuFor.value = null
  workout.addWarmupSets(id)
}
function ctxNote() {
  const id = contextMenuFor.value!
  contextMenuFor.value = null
  // Focus the notes textarea for that exercise block
  nextTick(() => {
    const blocks = document.querySelectorAll('.exercise-block')
    const exList = workout.activeExercises
    const idx    = exList.findIndex(e => e.exerciseId === id)
    const ta     = blocks[idx]?.querySelector<HTMLTextAreaElement>('.ex-notes-ta')
    ta?.focus()
  })
}
function ctxRest() {
  const id = contextMenuFor.value!
  contextMenuFor.value = null
  openRestSettings(id)
}
function ctxReplace() {
  const id = contextMenuFor.value!
  contextMenuFor.value = null
  openReplace(id)
}
function ctxRemove() {
  const id = contextMenuFor.value!
  contextMenuFor.value = null
  workout.removeExercise(id)
}

onMounted(async () => {
  if (!workout.hasActiveSession) { router.replace('/workout/start'); return }
  for (const ex of workout.activeExercises) {
    prevPerformance.value[ex.exerciseId] = await getPreviousPerformance(
      ex.exerciseId,
      workout.activeSession!.id
    )
  }
})

function openPlates(weightKg: number) {
  platesWeightKg.value = weightKg
  platesVisible.value  = true
}

function openRestSettings(exerciseId: string) {
  restSettingsFor.value = exerciseId
}

const REST_PRESETS   = [30, 60, 90, 120, 180, 240, 300]
const REST_SET_TYPES = [
  { type: 'working' as const, label: 'Working' },
  { type: 'warmup'  as const, label: 'Warm-up' },
  { type: 'failure' as const, label: 'Failure' },
  { type: 'drop'    as const, label: 'Drop' },
  { type: 'myorep'  as const, label: 'Myo-rep' },
]

function setRest(exerciseId: string, seconds: number, setType?: 'working' | 'warmup' | 'failure' | 'drop' | 'myorep') {
  exSettings.setRestTime(exerciseId, seconds, setType)
}

function formatRestLabel(s: number): string {
  if (s < 60) return `${s}s`
  const m = s / 60
  return m % 1 === 0 ? `${m}m` : `${Math.floor(m)}m${s % 60}s`
}

function resolveSetRest(ex: ActiveExercise, set: ActiveSet): number {
  return set.restSeconds ?? ex.restSeconds ?? exSettings.getRestTime(ex.exerciseId, set.set_type as any)
}

async function handleSetComplete(exerciseId: string, set: ActiveSet) {
  if (set.weight_kg && set.reps) {
    const pr = await checkIsNewPR(exerciseId, set.weight_kg, set.reps)
    if (pr) workout.updateSet(set.id, { isPR: true })
  }
  currentExerciseId.value = exerciseId
  const ex   = workout.activeExercises.find(e => e.exerciseId === exerciseId)
  const secs = resolveSetRest(ex!, set)
  restTimer.start(secs, set.id)
}

async function handleAddSet(exerciseId: string, exerciseName: string) {
  currentExerciseId.value = exerciseId
  const prev = prevPerformance.value[exerciseId]
  const set = await workout.logSet({
    exerciseId, exerciseName,
    setType:  'working',
    weightKg: prev?.weight_kg ?? null,
    reps:     prev?.reps      ?? null,
    rpe:      null,
    notes:    null,
  })
  if (set.weight_kg && set.reps) {
    const isPR = await checkIsNewPR(exerciseId, set.weight_kg, set.reps)
    if (isPR) set.isPR = true
  }
  prevPerformance.value[exerciseId] = await getPreviousPerformance(exerciseId, workout.activeSession!.id)
}

function handleSetUncomplete(setId: string) {
  if (restTimer.activeSetId.value === setId) {
    restTimer.skip()
  }
}

async function handleDeleteSet(setId: string) {
  await workout.deleteSet(setId)
}

async function handleFinish() {
  confirmFinish.value = false
  const finished = await workout.finishSession(sessionNotes.value)
  sessionNotes.value = ''
  router.replace('/history/' + finished.id)
}

function startDiscard() {
  confirmFinish.value  = false
  confirmDiscard.value = true
}

async function handleDiscard() {
  confirmDiscard.value = false
  await workout.discardSession()
  router.replace('/dashboard')
}
</script>

<style scoped>
.view { background: var(--bg); min-height: 100dvh; color: var(--text); font-family: 'DM Sans',sans-serif; padding-bottom: 5rem; padding-top: env(safe-area-inset-top, 0px); }

.workout-header {
  position: sticky; top: env(safe-area-inset-top, 0px); z-index: 50;
  display: flex; justify-content: space-between; align-items: center;
  background: var(--bg); border-bottom: 1px solid var(--surface);
  padding: 0.75rem 1rem;
}
.session-name {
  font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 800; color: var(--text); letter-spacing: 0.05em;
  cursor: pointer;
}
.session-name:active { color: var(--accent); }
.session-name-input {
  font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 800; letter-spacing: 0.05em;
  color: var(--text); background: transparent; border: none; border-bottom: 1px solid var(--accent);
  outline: none; width: 130px; padding: 0;
}
.session-timer { font-family: 'Barlow Condensed',sans-serif; font-size: 1.4rem; font-weight: 900; color: var(--accent); line-height: 1; }
.header-progress { display: flex; align-items: baseline; gap: 0; line-height: 1.1; }
.prog-name   { font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; }
.prog-sep    { font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; color: var(--muted); }
.prog-sets   { font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; font-weight: 700; color: var(--accent); }
.header-right  { display: flex; align-items: center; gap: 0.75rem; }
.header-stats  { display: flex; flex-direction: column; align-items: flex-end; gap: 0; }
.header-timer  { font-family: 'Barlow Condensed',sans-serif; font-size: 0.75rem; color: var(--accent); font-weight: 700; }
.header-vol    { font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; color: var(--muted); }
.finish-btn    { background: var(--accent); border: none; color: #fff; font-family: 'Barlow Condensed',sans-serif; font-weight: 800; font-size: 0.85rem; letter-spacing: 0.1em; padding: 0.5rem 1rem; cursor: pointer; clip-path: polygon(0 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%); }

.sticky-note-banner {
  display: flex; align-items: flex-start; gap: 0.4rem;
  background: rgba(255,180,0,0.07); border-left: 2px solid var(--gold);
  color: #C8900A; font-size: 0.78rem; line-height: 1.4;
  padding: 0.4rem 0.6rem; margin-bottom: 0.4rem;
}
.sticky-note-banner .pi { font-size: 0.7rem; margin-top: 0.1rem; flex-shrink: 0; }

.exercise-list { padding: 0 1rem; }
.exercise-block { margin-top: 1.5rem; }

.ex-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.ex-name   { font-family: 'Barlow Condensed',sans-serif; font-size: 1.1rem; font-weight: 800; color: var(--text); letter-spacing: 0.03em; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; }
.ex-link   { font-size: 0.7rem; color: var(--sub); }
.ex-actions { display: flex; align-items: center; gap: 0.1rem; }
.ex-dots-btn { background: none; border: none; color: var(--sub); cursor: pointer; padding: 0.4rem 0.5rem; font-size: 0.9rem; transition: color 0.15s; }
.ex-dots-btn:active { color: var(--accent); }

/* Exercise context menu */
.ctx-backdrop {
  position: fixed; inset: 0; z-index: 150;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: flex-end; justify-content: center;
}
.ctx-sheet {
  width: 100%; max-width: 520px;
  background: var(--bg); border-top: 2px solid var(--accent);
  padding-bottom: env(safe-area-inset-bottom, 1rem);
}
.ctx-handle {
  width: 36px; height: 4px; background: var(--border); border-radius: 2px;
  margin: 0.6rem auto 0; cursor: pointer;
}
.ctx-title {
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.72rem; font-weight: 700;
  letter-spacing: 0.15em; color: var(--muted); text-transform: uppercase;
  padding: 0.65rem 1rem 0.5rem;
}
.ctx-item {
  width: 100%; background: none; border: none; border-top: 1px solid var(--surface);
  display: flex; align-items: center; gap: 0.85rem;
  padding: 0.9rem 1.25rem;
  font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 700;
  color: #EBEBEB; cursor: pointer; text-align: left;
  transition: background 0.1s, color 0.1s;
}
.ctx-item:active { background: rgba(74,158,255,0.08); color: var(--accent); }
.ctx-item.ctx-danger { color: #FF4444; }
.ctx-item.ctx-danger:active { background: rgba(255,68,68,0.08); color: #FF4444; }
.ctx-icon { font-size: 0.9rem; color: var(--muted); flex-shrink: 0; width: 16px; text-align: center; }
.ctx-item:active .ctx-icon { color: inherit; }
.ctx-divider { height: 1px; background: var(--border); margin: 0.25rem 0; }

/* Headers grid matches SetRow: 28px 52px 1fr 1fr 36px */
.set-headers {
  display: grid;
  grid-template-columns: 28px 52px 1fr 1fr 36px;
  gap: 0.3rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--surface);
  margin-bottom: 0.2rem;
}
.set-headers span { font-family: 'Barlow Condensed',sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; color: var(--sub); text-align: center; }

.ex-hint {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
  padding: 0.3rem 0; margin-bottom: 0.25rem;
}
.ex-target {
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em;
  color: var(--accent); background: rgba(74,158,255,0.08); border: 1px solid rgba(74,158,255,0.2);
  padding: 0.1rem 0.45rem;
}
.ex-note-hint { font-size: 0.75rem; color: var(--muted); font-style: italic; }

.ex-notes-ta {
  width: 100%; background: var(--bg); border: 1px dashed var(--surface);
  color: var(--sub); font-family: 'DM Sans',sans-serif; font-size: 0.78rem;
  padding: 0.5rem 0.6rem; resize: none; box-sizing: border-box;
  margin-top: 0.5rem;
}
.ex-notes-ta::placeholder { color: var(--muted); }
.ex-notes-ta:focus { outline: none; border-color: var(--border); color: var(--text); }

.add-set-btn {
  width: 100%; background: var(--bg); border: 1px dashed var(--border); color: var(--muted);
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.1em;
  padding: 0.6rem; cursor: pointer; margin-top: 0.5rem;
  display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  transition: border-color 0.15s, color 0.15s;
}
.add-set-btn:active { border-color: var(--accent); color: var(--accent); }

.add-exercise-btn {
  width: calc(100% - 2rem); margin: 1.5rem 1rem 0;
  background: var(--bg); border: 1px solid var(--border); color: var(--sub);
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; font-weight: 700; letter-spacing: 0.1em;
  padding: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  transition: border-color 0.15s, color 0.15s;
  clip-path: var(--clip-md);
}
.add-exercise-btn:active { border-color: var(--accent); color: var(--accent); }

/* Rest settings sheet */
.rest-backdrop {
  position: fixed; inset: 0; z-index: 150;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: flex-end; justify-content: center;
}
.rest-sheet {
  width: 100%; max-width: 480px;
  background: var(--bg); border-top: 2px solid var(--accent);
  padding: 1.25rem 1rem 2rem;
}
.rest-sheet-title { font-family: 'Barlow Condensed',sans-serif; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.15em; color: var(--muted); margin-bottom: 0.75rem; }
.rest-sub { font-family: 'Barlow Condensed',sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.15em; color: var(--sub); margin-bottom: 0.4rem; }
.rest-presets { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.6rem; }
.rest-presets-sm .rest-preset { font-size: 0.7rem; padding: 0.25rem 0.5rem; }
.rest-type-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.35rem; }
.rest-type-label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.72rem; color: var(--muted); width: 52px; flex-shrink: 0; }
.rest-preset {
  background: var(--surface); border: 1px solid var(--border); color: var(--sub);
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.82rem; font-weight: 700;
  padding: 0.35rem 0.7rem; cursor: pointer; letter-spacing: 0.05em;
  transition: border-color 0.15s, color 0.15s;
}
.rest-preset.active { border-color: var(--accent); color: var(--accent); }
.rest-done {
  width: 100%; background: var(--accent); border: none; color: #fff;
  font-family: 'Barlow Condensed',sans-serif; font-weight: 800; font-size: 0.9rem; letter-spacing: 0.1em;
  padding: 0.75rem; cursor: pointer;
  clip-path: var(--clip-sm);
}

/* Dialog overrides */
/* Custom modals (replaces PrimeVue Dialog) */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.75);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}
.modal-box {
  width: 100%; max-width: 360px;
  background: var(--bg); border: 1px solid var(--border); border-top: 2px solid var(--accent);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem; border-bottom: 1px solid var(--surface);
}
.modal-title {
  font-family: 'Barlow Condensed',sans-serif; font-size: 1.1rem; font-weight: 800;
  color: var(--text); letter-spacing: 0.05em;
}
.modal-close {
  background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.85rem; padding: 0.1rem;
}
.modal-close:active { color: var(--accent); }
.modal-sub { color: #AEAEB2; font-size: 0.85rem; padding: 1.25rem 1.25rem 0; margin: 0; line-height: 1.4; }

.dialog-body { display: flex; flex-direction: column; gap: 0.75rem; padding: 1.25rem 1.25rem 0; }
.notes-input { width: 100%; background: var(--surface); border: 1px solid var(--border); color: var(--text); font-family: 'DM Sans',sans-serif; font-size: 0.82rem; padding: 0.6rem 0.75rem; resize: none; box-sizing: border-box; }
.notes-input:focus { outline: none; border-color: var(--accent); }
.notes-input::placeholder { color: var(--sub); }
.dialog-stat { display: flex; justify-content: space-between; font-size: 0.85rem; }
.dialog-stat span   { color: #AEAEB2; }
.dialog-stat strong { color: var(--text); font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 800; }

.dialog-actions { display: flex; gap: 0.5rem; padding: 1.25rem; }
.dialog-btn { flex: 1; border: none; font-family: 'Barlow Condensed',sans-serif; font-weight: 700; letter-spacing: 0.1em; font-size: 0.9rem; padding: 0.75rem; cursor: pointer; transition: background 0.15s; }
.dialog-btn.cancel       { background: var(--surface); color: #AEAEB2; }
.dialog-btn.finish       { background: var(--accent); color: #fff; clip-path: var(--clip-sm); }
.dialog-btn.discard      { background: transparent; color: #FF4444; border: 1px solid rgba(255,68,68,0.3); font-size: 0.8rem; flex: 0 0 auto; }
.dialog-btn.discard-confirm { background: #3A0000; color: #FF4444; border: 1px solid rgba(255,68,68,0.3); }
</style>
