<template>
  <div class="view">
    <!-- Header -->
    <div class="workout-header">
      <div class="header-left">
        <div class="session-name">{{ workout.activeSession?.name }}</div>
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
          <div class="ex-name">{{ ex.exerciseName }}</div>
          <div class="ex-actions">
            <button class="ex-action-btn" @click="openInfo(ex.exerciseId)" title="Exercise info">
              <i class="pi pi-info-circle" />
            </button>
            <button class="ex-action-btn" @click="openRestSettings(ex.exerciseId)" title="Rest time">
              <i class="pi pi-clock" />
            </button>
            <button
              v-if="ex.sets.some(s => s.set_type === 'working' && s.weight_kg)"
              class="ex-action-btn" @click="workout.addWarmupSets(ex.exerciseId)" title="Add warm-up sets"
            >
              <i class="pi pi-sun" />
            </button>
            <button class="ex-action-btn" @click="openReplace(ex.exerciseId)" title="Replace exercise">
              <i class="pi pi-sync" />
            </button>
            <button class="ex-action-btn ex-remove" @click="workout.removeExercise(ex.exerciseId)" title="Remove">
              <i class="pi pi-times" />
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

        <!-- Sets with inline rest timer -->
        <template v-for="set in ex.sets" :key="set.id">
          <SetRow
            :set="set"
            :prev="prevPerformance[ex.exerciseId]"
            :isPR="set.isPR"
            :isBodyweight="bodyweightIds.has(ex.exerciseId)"
            @update="(u) => workout.updateSet(set.id, u)"
            @delete="handleDeleteSet(set.id)"
            @complete="handleSetComplete(ex.exerciseId, set)"
            @openPlates="(kg) => openPlates(kg)"
          />
          <RestTimerInline v-if="restingAfterSetId === set.id" />
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

    <!-- Finish confirm dialog -->
    <Dialog v-model:visible="confirmFinish" modal header="Finish Workout?" :style="{ width: '90vw', maxWidth: '360px' }" class="mf-dialog">
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
    </Dialog>

    <!-- Discard confirm -->
    <Dialog v-model:visible="confirmDiscard" modal header="Discard Workout?" :style="{ width: '90vw', maxWidth: '360px' }" class="mf-dialog">
      <p style="color:#888;font-size:0.85rem;margin-bottom:1.5rem;">All sets will be lost. This cannot be undone.</p>
      <div class="dialog-actions">
        <button class="dialog-btn cancel" @click="confirmDiscard = false">Keep it</button>
        <button class="dialog-btn discard-confirm" @click="handleDiscard">Discard</button>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Dialog from 'primevue/dialog'
import { useWorkoutStore }          from '@/stores/workoutStore'
import type { ActiveSet }           from '@/stores/workoutStore'
import { useExerciseStore }         from '@/stores/exerciseStore'
import { useRestTimer }             from '@/composables/useRestTimer'
import { useExerciseSettings }      from '@/composables/useExerciseSettings'
import { useUnits }                 from '@/composables/useUnits'
import { getPreviousPerformance, type PreviousPerformance } from '@/composables/usePreviousPerformance'
import { checkIsNewPR }             from '@/composables/usePersonalRecords'
import SetRow               from '@/components/SetRow.vue'
import RestTimerInline      from '@/components/RestTimerInline.vue'
import PlateCalculatorModal from '@/components/PlateCalculatorModal.vue'
import ExerciseInfoSheet    from '@/components/ExerciseInfoSheet.vue'

const router        = useRouter()
const workout       = useWorkoutStore()
const exerciseStore = useExerciseStore()
const restTimer     = useRestTimer()
const exSettings    = useExerciseSettings()
const units         = useUnits()

const confirmFinish   = ref(false)
const confirmDiscard  = ref(false)
const sessionNotes    = ref('')
const prevPerformance = ref<Record<string, PreviousPerformance | null>>({})

// Inline rest timer — tracks which set row shows the bar
const restingAfterSetId = ref<string | null>(null)
watch(() => restTimer.isFinished.value, finished => {
  if (finished) setTimeout(() => { restingAfterSetId.value = null }, 2000)
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

async function handleSetComplete(exerciseId: string, set: ActiveSet) {
  if (set.weight_kg && set.reps) {
    const pr = await checkIsNewPR(exerciseId, set.weight_kg, set.reps)
    if (pr) workout.updateSet(set.id, { isPR: true })
  }
  currentExerciseId.value = exerciseId
  restingAfterSetId.value = set.id
  const ex   = workout.activeExercises.find(e => e.exerciseId === exerciseId)
  const secs = ex?.restSeconds ?? exSettings.getRestTime(exerciseId, set.set_type as any)
  restTimer.start(secs)
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
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap');
.view { background: #0A0A0A; min-height: 100dvh; color: #F0F0F0; font-family: 'DM Sans',sans-serif; padding-bottom: 5rem; }

.workout-header {
  position: sticky; top: 0; z-index: 50;
  display: flex; justify-content: space-between; align-items: center;
  background: #0A0A0A; border-bottom: 1px solid #1A1A1A;
  padding: 0.75rem 1rem;
}
.session-name  { font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 800; color: #F0F0F0; letter-spacing: 0.05em; }
.session-timer { font-family: 'Barlow Condensed',sans-serif; font-size: 1.4rem; font-weight: 900; color: #FF4D00; line-height: 1; }
.header-progress { display: flex; align-items: baseline; gap: 0; line-height: 1.1; }
.prog-name   { font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; font-weight: 700; color: #F0F0F0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; }
.prog-sep    { font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; color: #555; }
.prog-sets   { font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; font-weight: 700; color: #FF4D00; }
.header-right  { display: flex; align-items: center; gap: 0.75rem; }
.header-stats  { display: flex; flex-direction: column; align-items: flex-end; gap: 0; }
.header-timer  { font-family: 'Barlow Condensed',sans-serif; font-size: 0.75rem; color: #FF4D00; font-weight: 700; }
.header-vol    { font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; color: #555; }
.finish-btn    { background: #FF4D00; border: none; color: #fff; font-family: 'Barlow Condensed',sans-serif; font-weight: 800; font-size: 0.85rem; letter-spacing: 0.1em; padding: 0.5rem 1rem; cursor: pointer; clip-path: polygon(0 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%); }

.sticky-note-banner {
  display: flex; align-items: flex-start; gap: 0.4rem;
  background: rgba(255,180,0,0.07); border-left: 2px solid #FFB400;
  color: #C8900A; font-size: 0.78rem; line-height: 1.4;
  padding: 0.4rem 0.6rem; margin-bottom: 0.4rem;
}
.sticky-note-banner .pi { font-size: 0.7rem; margin-top: 0.1rem; flex-shrink: 0; }

.exercise-list { padding: 0 1rem; }
.exercise-block { margin-top: 1.5rem; }

.ex-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.ex-name   { font-family: 'Barlow Condensed',sans-serif; font-size: 1.1rem; font-weight: 800; color: #F0F0F0; letter-spacing: 0.03em; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; }
.ex-link   { font-size: 0.7rem; color: #444; }
.ex-actions { display: flex; align-items: center; gap: 0.1rem; }
.ex-action-btn { background: none; border: none; color: #333; cursor: pointer; padding: 0.3rem; font-size: 0.8rem; transition: color 0.15s; }
.ex-action-btn:active { color: #FF4D00; }
.ex-action-btn.ex-remove:active { color: #FF4444; }

/* Headers grid matches SetRow: 28px 52px 1fr 1fr 36px */
.set-headers {
  display: grid;
  grid-template-columns: 28px 52px 1fr 1fr 36px;
  gap: 0.3rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid #1A1A1A;
  margin-bottom: 0.2rem;
}
.set-headers span { font-family: 'Barlow Condensed',sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; color: #444; text-align: center; }

.ex-hint {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
  padding: 0.3rem 0; margin-bottom: 0.25rem;
}
.ex-target {
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em;
  color: #FF4D00; background: rgba(255,77,0,0.08); border: 1px solid rgba(255,77,0,0.2);
  padding: 0.1rem 0.45rem;
}
.ex-note-hint { font-size: 0.75rem; color: #555; font-style: italic; }

.ex-notes-ta {
  width: 100%; background: #0D0D0D; border: 1px dashed #1A1A1A;
  color: #666; font-family: 'DM Sans',sans-serif; font-size: 0.78rem;
  padding: 0.5rem 0.6rem; resize: none; box-sizing: border-box;
  margin-top: 0.5rem;
}
.ex-notes-ta::placeholder { color: #2A2A2A; }
.ex-notes-ta:focus { outline: none; border-color: #2A2A2A; color: #F0F0F0; }

.add-set-btn {
  width: 100%; background: #111; border: 1px dashed #2A2A2A; color: #555;
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.1em;
  padding: 0.6rem; cursor: pointer; margin-top: 0.5rem;
  display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  transition: border-color 0.15s, color 0.15s;
}
.add-set-btn:active { border-color: #FF4D00; color: #FF4D00; }

.add-exercise-btn {
  width: calc(100% - 2rem); margin: 1.5rem 1rem 0;
  background: #111; border: 1px solid #2A2A2A; color: #666;
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; font-weight: 700; letter-spacing: 0.1em;
  padding: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  transition: border-color 0.15s, color 0.15s;
  clip-path: polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);
}
.add-exercise-btn:active { border-color: #FF4D00; color: #FF4D00; }

/* Rest settings sheet */
.rest-backdrop {
  position: fixed; inset: 0; z-index: 150;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: flex-end; justify-content: center;
}
.rest-sheet {
  width: 100%; max-width: 480px;
  background: #111; border-top: 2px solid #FF4D00;
  padding: 1.25rem 1rem 2rem;
}
.rest-sheet-title { font-family: 'Barlow Condensed',sans-serif; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.15em; color: #555; margin-bottom: 0.75rem; }
.rest-sub { font-family: 'Barlow Condensed',sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.15em; color: #444; margin-bottom: 0.4rem; }
.rest-presets { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.6rem; }
.rest-presets-sm .rest-preset { font-size: 0.7rem; padding: 0.25rem 0.5rem; }
.rest-type-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.35rem; }
.rest-type-label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.72rem; color: #555; width: 52px; flex-shrink: 0; }
.rest-preset {
  background: #1A1A1A; border: 1px solid #2A2A2A; color: #666;
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.82rem; font-weight: 700;
  padding: 0.35rem 0.7rem; cursor: pointer; letter-spacing: 0.05em;
  transition: border-color 0.15s, color 0.15s;
}
.rest-preset.active { border-color: #FF4D00; color: #FF4D00; }
.rest-done {
  width: 100%; background: #FF4D00; border: none; color: #fff;
  font-family: 'Barlow Condensed',sans-serif; font-weight: 800; font-size: 0.9rem; letter-spacing: 0.1em;
  padding: 0.75rem; cursor: pointer;
  clip-path: polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%);
}

/* Dialog overrides */
:deep(.mf-dialog .p-dialog)         { background: #111 !important; border: 1px solid #2A2A2A !important; border-radius: 0 !important; }
:deep(.mf-dialog .p-dialog-header)  { background: #111 !important; color: #F0F0F0 !important; font-family: 'Barlow Condensed',sans-serif !important; font-weight: 800 !important; letter-spacing: 0.05em !important; border-bottom: 1px solid #1A1A1A !important; padding: 1rem 1.25rem !important; }
:deep(.mf-dialog .p-dialog-content) { background: #111 !important; padding: 1.25rem !important; }

.dialog-body { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
.notes-input { width: 100%; background: #1A1A1A; border: 1px solid #2A2A2A; color: #F0F0F0; font-family: 'DM Sans',sans-serif; font-size: 0.82rem; padding: 0.6rem 0.75rem; resize: none; box-sizing: border-box; }
.notes-input:focus { outline: none; border-color: #FF4D00; }
.notes-input::placeholder { color: #444; }
.dialog-stat { display: flex; justify-content: space-between; font-size: 0.85rem; }
.dialog-stat span   { color: #666; }
.dialog-stat strong { color: #F0F0F0; font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 800; }

.dialog-actions { display: flex; gap: 0.5rem; }
.dialog-btn { flex: 1; border: none; font-family: 'Barlow Condensed',sans-serif; font-weight: 700; letter-spacing: 0.1em; font-size: 0.9rem; padding: 0.75rem; cursor: pointer; transition: background 0.15s; }
.dialog-btn.cancel       { background: #1A1A1A; color: #888; }
.dialog-btn.finish       { background: #FF4D00; color: #fff; clip-path: polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%); }
.dialog-btn.discard      { background: transparent; color: #FF4444; border: 1px solid rgba(255,68,68,0.3); font-size: 0.8rem; }
.dialog-btn.discard-confirm { background: #3A0000; color: #FF4D00; border: 1px solid rgba(255,77,0,0.3); }
</style>
