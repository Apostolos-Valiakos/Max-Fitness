<template>
  <div class="view">
    <div class="view-header">
      <button class="back-btn" @click="router.back()"><i class="pi pi-arrow-left" /></button>
      <div class="header-body">
        <h1 class="session-name">{{ session?.name }}</h1>
        <div class="session-date">{{ formattedDate }}</div>
      </div>
    </div>

    <div v-if="loading" class="loading"><i class="pi pi-spin pi-spinner" /></div>

    <div v-else-if="session">
      <!-- Stats strip -->
      <div class="stats-strip">
        <div class="strip-stat">
          <div class="strip-val">{{ duration }}</div>
          <div class="strip-lbl">Duration</div>
        </div>
        <div class="strip-divider" />
        <div class="strip-stat">
          <div class="strip-val">{{ session.exerciseNames?.length ?? 0 }}</div>
          <div class="strip-lbl">Exercises</div>
        </div>
        <div class="strip-divider" />
        <div class="strip-stat">
          <div class="strip-val">{{ session.sets?.length ?? 0 }}</div>
          <div class="strip-lbl">Sets</div>
        </div>
        <div class="strip-divider" />
        <div class="strip-stat">
          <div class="strip-val">{{ Math.round(session.totalVolume ?? 0).toLocaleString() }}</div>
          <div class="strip-lbl">Vol (kg)</div>
        </div>
      </div>

      <!-- Exercise breakdown -->
      <div class="exercise-sections">
        <div v-for="(sets, exName) in byExercise" :key="exName" class="ex-section">
          <div class="ex-section-name">{{ exName }}</div>
          <div class="sets-table">
            <div class="table-header">
              <span>SET</span><span>TYPE</span><span>KG</span><span>REPS</span><span>RPE</span>
            </div>
            <div v-for="(set, i) in sets" :key="set.id" class="table-row">
              <span>{{ i + 1 }}</span>
              <span class="type-badge" :class="set.set_type">{{ set.set_type[0].toUpperCase() }}</span>
              <span>{{ set.weight_kg ?? '—' }}</span>
              <span>{{ set.reps ?? '—' }}</span>
              <span class="rpe">{{ set.rpe ?? '—' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="session.notes" class="session-notes">
        <div class="notes-label">NOTES</div>
        <p class="notes-text">{{ session.notes }}</p>
      </div>

      <!-- Trainer feedback (visible to client) -->
      <div v-if="feedback" class="session-notes trainer-feedback">
        <div class="notes-label feedback-label"><i class="pi pi-comment" /> TRAINER FEEDBACK</div>
        <p class="notes-text">{{ feedback.content }}</p>
      </div>

      <!-- Repeat workout -->
      <button class="repeat-btn" @click="handleRepeat" :disabled="repeating">
        <i class="pi pi-replay" />
        {{ repeating ? 'LOADING...' : 'REPEAT WORKOUT' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useHistoryStore } from '@/stores/historyStore'
import { useWorkoutStore } from '@/stores/workoutStore'
import { useTrainerStore } from '@/stores/trainerStore'
import { getDatabase }     from '@/lib/rxdb/database'
import { format }          from 'date-fns'
import type { SetDocument } from '@/lib/rxdb/schemas'

const props  = defineProps<{ id: string }>()
const router  = useRouter()
const history = useHistoryStore()
const workout = useWorkoutStore()
const trainerStore = useTrainerStore()
const session  = ref<any>(null)
const loading  = ref(true)
const repeating = ref(false)
const feedback = ref<{ id: string; content: string; trainer_id: string } | null>(null)

const formattedDate = computed(() => session.value ? format(new Date(session.value.started_at), 'EEEE, MMMM d yyyy') : '')
const duration      = computed(() => {
  if (!session.value?.finished_at) return '—'
  const secs = Math.floor((new Date(session.value.finished_at).getTime() - new Date(session.value.started_at).getTime()) / 1000)
  const m = Math.floor(secs / 60); const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
})

const byExercise = computed(() => {
  if (!session.value?.sets) return {}
  const db = getDatabase()
  const map: Record<string, SetDocument[]> = {}
  for (const set of session.value.sets) {
    const name = session.value._exerciseNameMap?.[set.exercise_id] ?? 'Unknown'
    if (!map[name]) map[name] = []
    map[name].push(set)
  }
  return map
})

onMounted(async () => {
  loading.value = true
  const data = await history.getSessionWithSets(props.id)
  if (data) {
    // Build name map
    const db   = getDatabase()
    const eIds = [...new Set(data.sets.map(s => s.exercise_id))]
    const exs  = await db.exercises.find({ selector: { id: { $in: eIds } } }).exec()
    const nm   = Object.fromEntries(exs.map(e => [e.id, e.name]))
    session.value = { ...data, _exerciseNameMap: nm }
  }
  feedback.value = await trainerStore.fetchSessionFeedback(props.id)
  loading.value = false
})

async function handleRepeat() {
  repeating.value = true
  await workout.duplicateSession(props.id)
  router.push('/workout/active')
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap');
.view { padding: 1.25rem 1rem 2rem; color: #F0F0F0; font-family: 'DM Sans',sans-serif; background: #0A0A0A; min-height: 100vh; }
.view-header { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 1.5rem; }
.back-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 1rem; padding-top: 0.25rem; flex-shrink: 0; }
.session-name { font-family: 'Barlow Condensed',sans-serif; font-size: 1.4rem; font-weight: 900; color: #F0F0F0; line-height: 1.1; }
.session-date { font-size: 0.72rem; color: #555; margin-top: 0.25rem; }
.loading { text-align: center; padding: 4rem; color: #555; }
.stats-strip { display: flex; align-items: center; background: #111; border: 1px solid #1A1A1A; padding: 1rem; margin-bottom: 1.5rem; }
.strip-stat { flex: 1; text-align: center; }
.strip-val { font-family: 'Barlow Condensed',sans-serif; font-size: 1.4rem; font-weight: 900; color: #F0F0F0; line-height: 1; }
.strip-lbl { font-size: 0.62rem; color: #555; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.2rem; }
.strip-divider { width: 1px; height: 32px; background: #1A1A1A; }
.exercise-sections { display: flex; flex-direction: column; gap: 1.25rem; }
.ex-section { background: #111; border: 1px solid #1A1A1A; padding: 1rem; }
.ex-section-name { font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 800; color: #F0F0F0; margin-bottom: 0.75rem; letter-spacing: 0.03em; }
.sets-table { width: 100%; }
.table-header, .table-row { display: grid; grid-template-columns: 32px 40px 1fr 1fr 1fr; gap: 0.25rem; padding: 0.3rem 0; }
.table-header { border-bottom: 1px solid #1A1A1A; margin-bottom: 0.25rem; }
.table-header span { font-family: 'Barlow Condensed',sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; color: #444; text-align: center; }
.table-row span { font-size: 0.82rem; color: #888; text-align: center; }
.type-badge { font-family: 'Barlow Condensed',sans-serif; font-weight: 800; font-size: 0.8rem; }
.type-badge.warmup  { color: #4488FF; }
.type-badge.working { color: #F0F0F0; }
.type-badge.failure { color: #FF4D00; }
.type-badge.drop    { color: #FFB400; }
.type-badge.myorep  { color: #00C851; }
.rpe { color: #555 !important; }
.session-notes { margin-top: 1.5rem; background: #111; border: 1px solid #1A1A1A; padding: 1rem; }
.trainer-feedback { border-color: rgba(255,77,0,0.3); background: rgba(255,77,0,0.05); }
.feedback-label { color: #FF4D00 !important; display: flex; align-items: center; gap: 0.35rem; }
.notes-label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em; color: #555; margin-bottom: 0.5rem; }
.notes-text { font-size: 0.85rem; color: #888; line-height: 1.5; }
.repeat-btn {
  width: 100%; margin-top: 1.5rem;
  background: #111; border: 1px solid #2A2A2A; color: #666;
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; font-weight: 700; letter-spacing: 0.1em;
  padding: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  transition: border-color 0.15s, color 0.15s;
  clip-path: polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);
}
.repeat-btn:active { border-color: #FF4D00; color: #FF4D00; }
.repeat-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
