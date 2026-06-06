<template>
  <div class="view">
    <div class="view-header">
      <button class="back-btn" @click="router.back()"><i class="pi pi-arrow-left" /></button>
      <div v-if="exercise" class="header-body">
        <h1 class="ex-name">{{ exercise.name }}</h1>
        <div class="ex-chips">
          <span class="chip">{{ exercise.body_part.replace('_',' ') }}</span>
          <span class="chip">{{ exercise.equipment }}</span>
          <span v-if="exercise.target_muscle" class="chip target">{{ exercise.target_muscle }}</span>
          <span v-if="exercise.is_custom" class="chip custom">Custom</span>
        </div>
      </div>
    </div>

    <!-- Tab navigation -->
    <div class="tab-nav">
      <button v-for="t in TABS" :key="t" class="tab-btn" :class="{ active: activeTab === t }" @click="activeTab = t">
        {{ t }}
      </button>
    </div>

    <!-- ─── ABOUT tab ─────────────────────────────────── -->
    <div v-if="activeTab === 'ABOUT'" class="tab-content">

      <div v-if="exercise?.image_url" class="gif-wrap">
        <ExerciseAnimation :imageUrl="exercise.image_url" :alt="exercise?.name" />
      </div>

      <div v-if="exercise?.secondary_muscles?.length" class="section">
        <h2 class="section-title">SECONDARY MUSCLES</h2>
        <div class="muscle-chips">
          <span v-for="m in exercise.secondary_muscles" :key="m" class="muscle-chip">{{ m }}</span>
        </div>
      </div>

      <div v-if="pr" class="pr-block">
        <div class="pr-label">PERSONAL RECORD</div>
        <div class="pr-value">{{ pr.weight_kg }} kg × {{ pr.reps }} reps</div>
        <div class="pr-e1rm">Est. 1RM: {{ pr.e1rm }} kg</div>
        <div class="pr-date">{{ format(new Date(pr.date), 'MMM d, yyyy') }}</div>
      </div>

      <section v-if="instructionSteps.length" class="section">
        <h2 class="section-title">HOW TO PERFORM</h2>
        <ol class="steps">
          <li v-for="(step, i) in instructionSteps" :key="i" class="step">
            <span class="step-num">{{ i + 1 }}</span>
            <span class="step-text">{{ step }}</span>
          </li>
        </ol>
      </section>

      <!-- Sticky note — editable if owner or admin -->
      <section v-if="exercise && (canEditStickyNote || exercise.sticky_note)" class="section">
        <h2 class="section-title">COACHING CUE</h2>
        <textarea
          v-if="canEditStickyNote"
          class="sticky-ta"
          rows="3"
          placeholder="Add a permanent coaching cue for this exercise..."
          :value="stickyDraft"
          @input="stickyDraft = ($event.target as HTMLTextAreaElement).value"
          @blur="saveStickyNote"
        />
        <p v-else class="sticky-readonly">{{ exercise.sticky_note }}</p>
      </section>

      <!-- Per-exercise rest preferences -->
      <section class="section">
        <h2 class="section-title">DEFAULT REST TIME</h2>
        <div class="rest-presets">
          <button
            v-for="s in REST_PRESETS" :key="s"
            class="rest-preset" :class="{ active: currentRest === s }"
            @click="exSettings.setRestTime(props.id, s)"
          >{{ formatRestLabel(s) }}</button>
        </div>
      </section>
    </div>

    <!-- ─── CHARTS tab ────────────────────────────────── -->
    <div v-if="activeTab === 'CHARTS'" class="tab-content">
      <div class="chart-sub-nav">
        <button v-for="c in CHART_TABS" :key="c" class="csub-btn" :class="{ active: activeChart === c }" @click="activeChart = c">
          {{ c }}
        </button>
      </div>
      <div class="chart-card" v-if="exercise">
        <StrengthChart   v-if="activeChart === '1RM'"        :exerciseId="exercise.id" />
        <VolumeChart     v-if="activeChart === 'VOLUME'"     :exerciseId="exercise.id" />
        <MaxWeightChart  v-if="activeChart === 'MAX WEIGHT'" :exerciseId="exercise.id" />
      </div>
    </div>

    <!-- ─── RECORDS tab ───────────────────────────────── -->
    <div v-if="activeTab === 'RECORDS'" class="tab-content">
      <div v-if="repRecords.length" class="records-wrap">
        <div class="rec-header">
          <span>REPS</span><span>WEIGHT</span><span>EST. 1RM</span><span>DATE</span>
        </div>
        <div v-for="r in repRecords" :key="r.reps" class="rec-row">
          <span class="rep-badge">{{ r.reps }}RM</span>
          <span class="rec-weight">{{ r.weight_kg }} kg</span>
          <span class="rec-e1rm">{{ r.e1rm }} kg</span>
          <span class="rec-date">{{ format(new Date(r.date), 'MMM d, yy') }}</span>
        </div>
      </div>
      <div v-else class="empty-state">No working sets logged yet.</div>
    </div>

    <button v-if="workout.hasActiveSession" class="add-to-workout-btn" @click="addToWorkout">
      ADD TO CURRENT WORKOUT
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getDatabase }         from '@/lib/rxdb/database'
import { useWorkoutStore }     from '@/stores/workoutStore'
import { useExerciseStore }    from '@/stores/exerciseStore'
import { useAuthStore }        from '@/stores/authStore'
import { useExerciseSettings } from '@/composables/useExerciseSettings'
import { getExercisePR, getRepRecords, type PR, type RepRecord } from '@/composables/usePersonalRecords'
import VolumeChart        from '@/components/VolumeChart.vue'
import ExerciseAnimation  from '@/components/ExerciseAnimation.vue'
import StrengthChart  from '@/components/StrengthChart.vue'
import MaxWeightChart from '@/components/MaxWeightChart.vue'
import { format } from 'date-fns'
import type { ExerciseDocument } from '@/lib/rxdb/schemas'

const props = defineProps<{ id: string }>()
const router        = useRouter()
const workout       = useWorkoutStore()
const exerciseStore = useExerciseStore()
const auth          = useAuthStore()
const exSettings    = useExerciseSettings()

const exercise    = ref<ExerciseDocument | null>(null)
const pr          = ref<PR | null>(null)
const repRecords  = ref<RepRecord[]>([])
const stickyDraft = ref('')

const TABS       = ['ABOUT', 'CHARTS', 'RECORDS'] as const
const CHART_TABS = ['1RM', 'VOLUME', 'MAX WEIGHT'] as const
const REST_PRESETS = [30, 60, 90, 120, 180, 240, 300]

const activeTab   = ref<typeof TABS[number]>('ABOUT')
const activeChart = ref<typeof CHART_TABS[number]>('1RM')

const currentRest = computed(() => exSettings.getRestTime(props.id))

const instructionSteps = computed(() => {
  if (!exercise.value?.instructions) return []
  return exercise.value.instructions.split('\n').filter(Boolean)
})

const canEditStickyNote = computed(() =>
  !!exercise.value && (exercise.value.created_by === auth.user?.id || auth.isAdmin)
)

function formatRestLabel(s: number): string {
  if (s < 60) return `${s}s`
  const m = s / 60
  return m % 1 === 0 ? `${m}m` : `${Math.floor(m)}m${s % 60}s`
}

onMounted(async () => {
  const db  = getDatabase()
  const doc = await db.exercises.findOne(props.id).exec()
  if (doc) {
    exercise.value = doc.toJSON()
    stickyDraft.value = exercise.value?.sticky_note ?? ''
  }
  ;[pr.value, repRecords.value] = await Promise.all([
    getExercisePR(props.id),
    getRepRecords(props.id),
  ])
})

async function saveStickyNote() {
  if (!exercise.value) return
  try {
    await exerciseStore.updateStickyNote(exercise.value.id, stickyDraft.value)
    exercise.value = { ...exercise.value, sticky_note: stickyDraft.value.trim() || null }
  } catch {}
}

function addToWorkout() {
  if (!exercise.value) return
  workout.addExercise(exercise.value.id, exercise.value.name)
  router.push('/workout/active')
}
</script>

<style scoped>
.view { color: #F0F0F0; font-family: 'DM Sans',sans-serif; background: #1C1C1E; min-height: 100vh; padding-bottom: 5rem; }

.view-header { display: flex; align-items: flex-start; gap: 0.75rem; padding: 1.25rem 1rem 0.75rem; }
.back-btn { background: none; border: none; color: #8E8E93; cursor: pointer; font-size: 1rem; padding-top: 0.25rem; flex-shrink: 0; }
.header-body { flex: 1; min-width: 0; }
.ex-name { font-family: 'Barlow Condensed',sans-serif; font-size: 1.6rem; font-weight: 900; color: #F0F0F0; line-height: 1; margin-bottom: 0.4rem; text-transform: uppercase; }
.ex-chips { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.chip { background: #252528; border: 1px solid #3A3A3C; padding: 0.2rem 0.5rem; font-family: 'Barlow Condensed',sans-serif; font-size: 0.65rem; font-weight: 700; color: #8E8E93; text-transform: capitalize; letter-spacing: 0.05em; }
.chip.target { color: #4A9EFF; border-color: rgba(74,158,255,0.3); background: rgba(74,158,255,0.06); }
.chip.custom { color: #FFB400; border-color: rgba(255,180,0,0.3); }

/* Tabs */
.tab-nav { display: flex; border-bottom: 1px solid #252528; }
.tab-btn {
  flex: 1; background: none; border: none; border-bottom: 2px solid transparent;
  color: #636366; font-family: 'Barlow Condensed',sans-serif; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.12em;
  padding: 0.65rem 0; cursor: pointer; transition: color 0.15s, border-color 0.15s; margin-bottom: -1px;
}
.tab-btn.active { color: #4A9EFF; border-bottom-color: #4A9EFF; }

.tab-content { padding: 1.25rem 1rem 0; }

/* About */
.gif-wrap { width: 100%; background: #1C1C1E; border: 1px solid #252528; display: flex; justify-content: center; margin-bottom: 1.25rem; overflow: hidden; }
.ex-gif { max-height: 280px; width: auto; max-width: 100%; object-fit: contain; display: block; }

.muscle-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.muscle-chip { font-family: 'Barlow Condensed',sans-serif; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: capitalize; padding: 0.2rem 0.55rem; border: 1px solid #3A3A3C; color: #AEAEB2; background: #252528; }

.pr-block { background: rgba(255,180,0,0.05); border: 1px solid rgba(255,180,0,0.2); padding: 1.25rem; margin-bottom: 1.5rem; }
.pr-label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.25em; color: #FFB400; margin-bottom: 0.5rem; }
.pr-value { font-family: 'Barlow Condensed',sans-serif; font-size: 2rem; font-weight: 900; color: #FFB400; line-height: 1; }
.pr-e1rm { font-size: 0.8rem; color: #AEAEB2; margin-top: 0.3rem; }
.pr-date { font-size: 0.7rem; color: #636366; margin-top: 0.1rem; }

.section { margin-bottom: 1.5rem; }

.steps { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.step { display: flex; align-items: flex-start; gap: 0.65rem; font-size: 0.84rem; color: #AEAEB2; line-height: 1.55; }
.step-num { font-family: 'Barlow Condensed',sans-serif; font-size: 1.1rem; font-weight: 900; color: #4A9EFF; min-width: 1.4rem; flex-shrink: 0; line-height: 1.3; }

.sticky-ta { width: 100%; box-sizing: border-box; background: #1C1C1E; border: 1px solid #3A3A3C; border-left: 2px solid #FFB400; color: #C8900A; font-family: 'DM Sans',sans-serif; font-size: 0.82rem; padding: 0.6rem 0.75rem; resize: none; }
.sticky-ta::placeholder { color: #3A3A00; }
.sticky-ta:focus { outline: none; border-color: #FFB400; color: #F0F0F0; }
.sticky-readonly { background: rgba(255,180,0,0.05); border-left: 2px solid #FFB400; color: #C8900A; font-size: 0.82rem; padding: 0.5rem 0.75rem; margin: 0; line-height: 1.5; }

.rest-presets { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.rest-preset { background: #252528; border: 1px solid #3A3A3C; color: #8E8E93; font-family: 'Barlow Condensed',sans-serif; font-size: 0.82rem; font-weight: 700; padding: 0.35rem 0.7rem; cursor: pointer; letter-spacing: 0.05em; transition: border-color 0.15s, color 0.15s; }
.rest-preset.active { border-color: #4A9EFF; color: #4A9EFF; }

/* Charts */
.chart-sub-nav { display: flex; gap: 0.4rem; margin-bottom: 1rem; }
.csub-btn { background: #1C1C1E; border: 1px solid #3A3A3C; color: #636366; font-family: 'Barlow Condensed',sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.35rem 0.75rem; cursor: pointer; transition: all 0.15s; }
.csub-btn.active { border-color: #4A9EFF; color: #4A9EFF; background: rgba(74,158,255,0.07); }
.chart-card { background: #1C1C1E; border: 1px solid #252528; padding: 1rem; }

/* Records */
.records-wrap { display: flex; flex-direction: column; gap: 0; }
.rec-header { display: grid; grid-template-columns: 52px 1fr 1fr 1fr; padding: 0.35rem 0.5rem; border-bottom: 1px solid #252528; }
.rec-header span { font-family: 'Barlow Condensed',sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.12em; color: #8E8E93; }
.rec-row { display: grid; grid-template-columns: 52px 1fr 1fr 1fr; padding: 0.65rem 0.5rem; border-bottom: 1px solid #1C1C1E; align-items: center; }
.rec-row:hover { background: #1C1C1E; }
.rep-badge { font-family: 'Barlow Condensed',sans-serif; font-size: 0.85rem; font-weight: 800; color: #4A9EFF; }
.rec-weight { font-size: 0.82rem; color: #F0F0F0; }
.rec-e1rm { font-size: 0.78rem; color: #FFB400; }
.rec-date { font-size: 0.7rem; color: #636366; }

.empty-state { text-align: center; padding: 3rem 1rem; color: #8E8E93; font-size: 0.85rem; }

.add-to-workout-btn { width: calc(100% - 2rem); margin: 1.5rem 1rem 0; background: #4A9EFF; border: none; color: #fff; font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 800; letter-spacing: 0.1em; padding: 1rem; cursor: pointer; clip-path: polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%); display: block; }
.add-to-workout-btn:active { background: #3B8EEF; }
</style>
