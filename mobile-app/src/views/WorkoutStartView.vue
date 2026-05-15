<template>
  <div class="view">
    <div class="view-header">
      <button class="back-btn" @click="router.back()"><i class="pi pi-arrow-left" /></button>
      <h1 class="view-title">START WORKOUT</h1>
    </div>

    <!-- Quick start -->
    <section class="section">
      <button class="quick-start-btn" @click="startEmpty">
        <div class="qs-icon"><i class="pi pi-plus" /></div>
        <div class="qs-body">
          <div class="qs-title">EMPTY WORKOUT</div>
          <div class="qs-sub">Start from scratch</div>
        </div>
        <i class="pi pi-chevron-right qs-arrow" />
      </button>
    </section>

    <!-- Recent workouts -->
    <section class="section" v-if="recentSessions.length">
      <div class="section-header">
        <h2 class="section-title">RECENT WORKOUTS</h2>
        <router-link to="/history" class="see-all">All</router-link>
      </div>
      <div class="recent-list">
        <div
          v-for="s in recentSessions" :key="s.id"
          class="recent-card"
          @click="redoSession(s)"
        >
          <div class="rc-body">
            <div class="rc-name">{{ s.name }}</div>
            <div class="rc-meta">{{ formatSessionDate(s.started_at) }}</div>
          </div>
          <i class="pi pi-replay rc-icon" title="Redo" />
        </div>
      </div>
    </section>

    <!-- Templates -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">MY TEMPLATES</h2>
        <router-link to="/templates" class="see-all">Manage</router-link>
      </div>

      <div v-if="templates.templates.length === 0" class="empty-state">
        <p>No templates yet.</p>
        <router-link to="/templates" class="link-btn">Create a template</router-link>
      </div>

      <div v-else class="template-list">
        <div
          v-for="t in templates.templates" :key="t.id"
          class="template-card"
          @click="startFromTemplate(t)"
        >
          <div class="t-body">
            <div class="t-name-row">
              <div class="t-name">{{ t.name }}</div>
              <span v-if="t.assigned_by" class="t-trainer-badge">TRAINER</span>
            </div>
            <div class="t-note" v-if="t.notes">{{ t.notes }}</div>
            <div v-if="t.owner_id !== auth.user?.id" class="t-creator">by {{ creatorNames[t.owner_id] ?? '…' }}</div>
            <div class="t-exercises" v-if="templateExercises[t.id]?.length">
              <span
                v-for="(name, i) in templateExercises[t.id].slice(0, 4)" :key="i"
                class="t-ex-chip"
              >{{ name }}</span>
              <span v-if="templateExercises[t.id].length > 4" class="t-ex-more">
                +{{ templateExercises[t.id].length - 4 }}
              </span>
            </div>
          </div>
          <i class="pi pi-play t-play" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkoutStore }   from '@/stores/workoutStore'
import { useTemplateStore }  from '@/stores/templateStore'
import { useExerciseStore }  from '@/stores/exerciseStore'
import { useAuthStore }      from '@/stores/authStore'
import { getDatabase }       from '@/lib/rxdb/database'
import { supabase }          from '@/lib/supabase'
import { format, isToday, isYesterday } from 'date-fns'
import type { WorkoutTemplateDocument, WorkoutSessionDocument } from '@/lib/rxdb/schemas'

const router    = useRouter()
const workout   = useWorkoutStore()
const templates = useTemplateStore()
const exercises = useExerciseStore()
const auth      = useAuthStore()

// template id → exercise names array
const templateExercises = ref<Record<string, string[]>>({})
const creatorNames      = ref<Record<string, string>>({})
const recentSessions    = ref<WorkoutSessionDocument[]>([])

onMounted(async () => {
  if (auth.user?.id) templates.subscribeToTemplates(auth.user.id)
  exercises.subscribeToExercises()
  await loadRecentSessions()
})

async function loadRecentSessions() {
  if (!auth.user?.id) return
  const db = getDatabase()
  const sessions = await db.workout_sessions.find({
    selector: { user_id: { $eq: auth.user.id }, finished_at: { $ne: null } },
    sort: [{ started_at: 'desc' }],
    limit: 5,
  }).exec()
  recentSessions.value = sessions.map(s => s.toJSON())
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso)
  if (isToday(d))     return `Today · ${format(d, 'h:mm a')}`
  if (isYesterday(d)) return `Yesterday · ${format(d, 'h:mm a')}`
  return format(d, 'EEE, MMM d')
}

async function redoSession(session: WorkoutSessionDocument) {
  await workout.duplicateSession(session.id)
  router.push('/workout/active')
}

watch(() => templates.templates, async (list) => {
  for (const t of list) {
    if (templateExercises.value[t.id]) continue
    const tes = await templates.getTemplateExercises(t.id)
    templateExercises.value[t.id] = tes.map(te => {
      const ex = exercises.exercises.find(e => e.id === te.exercise_id)
      return ex?.name ?? '?'
    })
  }
  // Batch-fetch creator names for non-owned templates
  const unknownIds = [...new Set(
    list.map(t => t.owner_id).filter(id => id !== auth.user?.id && !creatorNames.value[id])
  )]
  if (unknownIds.length) {
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', unknownIds)
    for (const p of data ?? []) creatorNames.value[p.id] = p.full_name ?? 'Unknown'
  }
}, { immediate: true })

async function startEmpty() {
  const name = `Workout — ${new Date().toLocaleDateString('en', { weekday:'short', month:'short', day:'numeric' })}`
  await workout.startSession(name)
  router.push('/workout/active')
}

async function startFromTemplate(t: WorkoutTemplateDocument) {
  await workout.startSession(t.name, t.id)
  router.push('/workout/active')
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap');
.view { padding: 1.5rem 1rem; color: #F0F0F0; font-family: 'DM Sans',sans-serif; background: #0A0A0A; min-height: 100vh; }
.view-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; }
.back-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 1rem; padding: 0.25rem; }
.view-title { font-family: 'Barlow Condensed',sans-serif; font-size: 1.4rem; font-weight: 900; letter-spacing: 0.05em; color: #F0F0F0; }
.section { margin-bottom: 2rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.section-title { font-family: 'Barlow Condensed',sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.2em; color: #555; }
.see-all { font-size: 0.72rem; color: #FF4D00; text-decoration: none; }

.quick-start-btn {
  width: 100%; display: flex; align-items: center; gap: 1rem;
  background: #111; border: 1px solid #FF4D00; padding: 1.25rem 1rem;
  cursor: pointer; transition: background 0.2s;
  clip-path: polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%);
}
.quick-start-btn:active { background: #1A1A1A; }
.qs-icon { width: 44px; height: 44px; background: #FF4D00; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.2rem; flex-shrink: 0; }
.qs-body { flex: 1; text-align: left; }
.qs-title { font-family: 'Barlow Condensed',sans-serif; font-size: 1.1rem; font-weight: 800; color: #F0F0F0; letter-spacing: 0.05em; }
.qs-sub { font-size: 0.75rem; color: #555; margin-top: 0.15rem; }
.qs-arrow { color: #FF4D00; }

.template-list { display: flex; flex-direction: column; gap: 0.5rem; }
.template-card {
  display: flex; align-items: center; gap: 1rem;
  background: #111; border: 1px solid #1A1A1A; padding: 1rem;
  cursor: pointer; transition: border-color 0.2s;
  clip-path: polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);
}
.template-card:active { border-color: #FF4D00; }
.t-body { flex: 1; min-width: 0; }
.t-name-row { display: flex; align-items: center; gap: 0.5rem; }
.t-name { font-family: 'Barlow Condensed',sans-serif; font-size: 1.1rem; font-weight: 700; color: #F0F0F0; }
.t-trainer-badge { font-family: 'Barlow Condensed',sans-serif; font-size: 0.55rem; font-weight: 800; letter-spacing: 0.15em; color: #FFB400; background: rgba(255,180,0,0.1); border: 1px solid rgba(255,180,0,0.3); padding: 0.1rem 0.35rem; flex-shrink: 0; }
.t-note { font-size: 0.72rem; color: #555; margin-top: 0.1rem; }
.t-creator { font-size: 0.65rem; color: #FF4D00; opacity: 0.7; margin-top: 0.1rem; }
.t-exercises { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.5rem; }
.t-ex-chip { font-size: 0.65rem; color: #555; background: #1A1A1A; border: 1px solid #2A2A2A; padding: 0.15rem 0.45rem; white-space: nowrap; }
.t-ex-more { font-size: 0.65rem; color: #444; align-self: center; }
.t-play { color: #FF4D00; font-size: 0.8rem; flex-shrink: 0; }

.empty-state { text-align: center; padding: 2rem 1rem; color: #444; font-size: 0.85rem; }
.link-btn { color: #FF4D00; text-decoration: none; font-size: 0.85rem; }

.recent-list { display: flex; flex-direction: column; gap: 0.4rem; }
.recent-card {
  display: flex; align-items: center; gap: 1rem;
  background: #111; border: 1px solid #1A1A1A; padding: 0.85rem 1rem;
  cursor: pointer; transition: border-color 0.2s;
  clip-path: polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%);
}
.recent-card:active { border-color: #FF4D00; }
.rc-body { flex: 1; min-width: 0; }
.rc-name { font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 700; color: #F0F0F0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rc-meta { font-size: 0.7rem; color: #555; margin-top: 0.1rem; }
.rc-icon { color: #FF4D00; font-size: 0.85rem; flex-shrink: 0; }
</style>
