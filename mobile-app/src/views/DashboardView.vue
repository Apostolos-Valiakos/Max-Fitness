<template>
  <div class="view">
    <header class="view-header">
      <div>
        <div class="greeting">{{ greeting }}</div>
        <h1 class="view-title">{{ auth.profile?.full_name?.split(' ')[0] ?? 'Athlete' }}</h1>
      </div>
      <div class="header-badge" :class="auth.profile?.tier">{{ auth.profile?.tier?.toUpperCase() }}</div>
    </header>

    <!-- Today's Workout card (clients on a plan) -->
    <section v-if="trainerStore.todayTemplate" class="today-card" @click="startTodayWorkout">
      <div class="today-label">TODAY'S WORKOUT</div>
      <div class="today-name">{{ trainerStore.todayTemplate.template_name }}</div>
      <div class="today-plan">{{ trainerStore.todayTemplate.plan_name }}</div>
      <button class="today-btn"><i class="pi pi-play" /> START</button>
    </section>

    <div class="stats-grid">
      <StatCard icon="pi pi-bolt"      :value="history.getCurrentStreak()" label="Day Streak" />
      <StatCard icon="pi pi-calendar"  :value="history.getWeeklyCount()"   label="This Week" />
      <StatCard icon="pi pi-chart-bar" :value="history.getMonthlyCount()"  label="This Month" />
      <StatCard icon="pi pi-trophy"    :value="history.sessions.length"    label="Total" />
    </div>

    <section class="section">
      <h2 class="section-title">WORKOUT FREQUENCY</h2>
      <div class="chart-card"><FrequencyChart /></div>
    </section>

    <section class="section" v-if="profileStore.bodyweightLog.length > 1">
      <h2 class="section-title">BODYWEIGHT</h2>
      <div class="chart-card"><BodyweightChart :entries="profileStore.bodyweightLog" /></div>
    </section>

    <section class="section">
      <h2 class="section-title">VOLUME BY MUSCLE</h2>
      <div class="chart-card"><MuscleVolumeChart /></div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">RECENT SESSIONS</h2>
        <router-link to="/history" class="see-all">See all</router-link>
      </div>
      <div v-if="recentWithMeta.length === 0" class="empty-state">
        <p>No workouts yet.</p>
        <button class="cta-btn" @click="router.push('/workout/start')">Start your first workout</button>
      </div>
      <div v-else class="sessions-list">
        <SessionCard
          v-for="s in recentWithMeta.slice(0,5)" :key="s.id"
          :session="s" :exerciseNames="s.exerciseNames" :totalVolume="s.totalVolume"
          @click="router.push('/history/'+s.id)"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore }    from '@/stores/authStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useProfileStore } from '@/stores/profileStore'
import { useTrainerStore } from '@/stores/trainerStore'
import { useWorkoutStore } from '@/stores/workoutStore'
import { getDatabase }     from '@/lib/rxdb/database'
import { supabase }        from '@/lib/supabase'
import StatCard         from '@/components/StatCard.vue'
import SessionCard      from '@/components/SessionCard.vue'
import FrequencyChart   from '@/components/FrequencyChart.vue'
import BodyweightChart  from '@/components/BodyweightChart.vue'
import MuscleVolumeChart from '@/components/MuscleVolumeChart.vue'

const router       = useRouter()
const auth         = useAuthStore()
const history      = useHistoryStore()
const profileStore = useProfileStore()
const trainerStore = useTrainerStore()
const workout      = useWorkoutStore()
const recentWithMeta = ref<any[]>([])

const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,'
})

async function startTodayWorkout() {
  const t = trainerStore.todayTemplate
  if (!t) return
  // Fetch the template exercises from Supabase (trainer's template)
  const { data: exRows } = await supabase
    .from('template_exercises')
    .select('exercise_id, target_sets, target_reps, position')
    .eq('template_id', t.template_id)
    .order('position')
  // Navigate to workout start pre-loaded with this template
  router.push({ name: 'WorkoutStart', query: { templateId: t.template_id, templateName: t.template_name } })
}

async function enrichSessions() {
  const db = getDatabase()
  const enriched = await Promise.all(
    history.sessions.slice(0, 5).map(async s => {
      const sets  = await db.sets.find({ selector: { session_id: { $eq: s.id } } }).exec()
      const sd    = sets.map(x => x.toJSON())
      const eIds  = [...new Set(sd.map(x => x.exercise_id))]
      const ed    = await db.exercises.find({ selector: { id: { $in: eIds } } }).exec()
      const nm    = Object.fromEntries(ed.map(e => [e.id, e.name]))
      return { ...s, exerciseNames: eIds.map(id => nm[id] ?? 'Unknown'), totalVolume: sd.reduce((a, x) => a + ((x.weight_kg ?? 0) * (x.reps ?? 0)), 0) }
    })
  )
  recentWithMeta.value = enriched
}

onMounted(async () => {
  if (auth.user?.id) {
    history.subscribeToSessions(auth.user.id)
    await profileStore.fetchBodyweightLog(auth.user.id)
    // Only fetch today's plan template for non-trainer users (clients)
    if (auth.profile?.role === 'user') {
      await trainerStore.fetchTodayTemplate()
    }
  }
  history.$subscribe(enrichSessions)
  await enrichSessions()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap');
.view { padding: 1.5rem 1rem 0; color: #F0F0F0; font-family: 'DM Sans',sans-serif; background: #0A0A0A; min-height: 100vh; }
.view-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.greeting { font-size: 0.72rem; color: #555; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.2rem; }
.view-title { font-family: 'Barlow Condensed',sans-serif; font-size: 2rem; font-weight: 900; color: #F0F0F0; line-height: 1; }
.header-badge { padding: 0.3rem 0.6rem; font-family: 'Barlow Condensed',sans-serif; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.2em; }
.header-badge.free  { background: #1A1A1A; color: #555; }
.header-badge.paid  { background: rgba(255,77,0,0.1); color: #FF4D00; border: 1px solid rgba(255,77,0,0.3); }
.header-badge.ultra { background: rgba(255,180,0,0.1); color: #FFB400; border: 1px solid rgba(255,180,0,0.3); }

/* Today's workout card */
.today-card {
  background: linear-gradient(135deg, rgba(255,77,0,0.15), rgba(255,77,0,0.05));
  border: 1px solid rgba(255,77,0,0.4);
  padding: 1.25rem; margin-bottom: 1.25rem; cursor: pointer;
  display: flex; flex-direction: column; gap: 0.25rem;
  position: relative; transition: border-color 0.15s;
}
.today-card:hover { border-color: rgba(255,77,0,0.7); }
.today-label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.6rem; font-weight: 700; color: #FF4D00; letter-spacing: 0.2em; }
.today-name  { font-family: 'Barlow Condensed',sans-serif; font-size: 1.5rem; font-weight: 900; color: #F0F0F0; line-height: 1; }
.today-plan  { font-size: 0.7rem; color: #888; }
.today-btn {
  position: absolute; right: 1rem; top: 50%; transform: translateY(-50%);
  background: #FF4D00; border: none; color: #fff;
  display: flex; align-items: center; gap: 0.35rem;
  padding: 0.5rem 0.875rem; font-family: 'Barlow Condensed',sans-serif;
  font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; cursor: pointer;
}

.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 1.5rem; }
.section { margin-bottom: 1.5rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.section-title { font-family: 'Barlow Condensed',sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.2em; color: #555; margin-bottom: 0.75rem; }
.see-all { font-size: 0.72rem; color: #FF4D00; text-decoration: none; }
.chart-card { background: #111; border: 1px solid #1A1A1A; padding: 1rem; }
.sessions-list { display: flex; flex-direction: column; gap: 0.5rem; }
.empty-state { text-align: center; padding: 2rem 1rem; color: #777; }
.cta-btn { background: #FF4D00; border: none; color: #fff; font-family: 'Barlow Condensed',sans-serif; font-weight: 700; letter-spacing: 0.1em; padding: 0.75rem 1.5rem; cursor: pointer; margin-top: 1rem; clip-path: polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%); }
</style>
