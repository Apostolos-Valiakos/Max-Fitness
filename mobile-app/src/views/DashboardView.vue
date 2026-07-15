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
      <button class="today-btn" :disabled="launching">
        <i :class="launching ? 'pi pi-spin pi-spinner' : 'pi pi-play'" /> START
      </button>
    </section>

    <!-- Check-in due card (nearest pending assignment) -->
    <section v-if="nearestCheckin" class="checkin-card" @click="openNearestCheckin">
      <div class="checkin-label">CHECK-IN DUE</div>
      <div class="checkin-name">{{ nearestCheckin.template_name }}</div>
      <div class="checkin-due">Due {{ formatCheckinDue(nearestCheckin.next_due_at) }}</div>
      <i class="pi pi-chevron-right checkin-arrow" />
    </section>

    <!-- Dialog A: active session conflict -->
    <Dialog v-model:visible="showConflictDialog" modal header="WORKOUT IN PROGRESS" :style="{ width: '88vw', maxWidth: '340px' }">
      <p class="dlg-body">You already have a workout in progress. Continue it or start the assigned session?</p>
      <template #footer>
        <Button label="Continue existing" severity="secondary" text @click="continueExisting" />
        <Button label="Start assigned" @click="openFinishDialog" />
      </template>
    </Dialog>

    <!-- Dialog B: finish/discard current session -->
    <Dialog v-model:visible="showFinishDialog" modal header="FINISH CURRENT WORKOUT?" :style="{ width: '88vw', maxWidth: '340px' }">
      <p class="dlg-body">Save your current workout before starting the assigned session, or discard it?</p>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="cancelFinish" />
        <Button label="Discard" severity="danger" outlined @click="discardAndStart" />
        <Button label="Save &amp; Start" @click="saveAndStart" />
      </template>
    </Dialog>

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
import { useRouter, useRoute } from 'vue-router'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuthStore }    from '@/stores/authStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useProfileStore } from '@/stores/profileStore'
import { useTrainerStore } from '@/stores/trainerStore'
import { useWorkoutStore } from '@/stores/workoutStore'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import StatCard         from '@/components/StatCard.vue'
import SessionCard      from '@/components/SessionCard.vue'
import FrequencyChart   from '@/components/FrequencyChart.vue'
import BodyweightChart  from '@/components/BodyweightChart.vue'
import MuscleVolumeChart from '@/components/MuscleVolumeChart.vue'

const router       = useRouter()
const route        = useRoute()
const auth         = useAuthStore()
const history      = useHistoryStore()
const profileStore = useProfileStore()
const trainerStore = useTrainerStore()
const workout      = useWorkoutStore()
const recentWithMeta = ref<any[]>([])

const launching          = ref(false)
const showConflictDialog = ref(false)
const showFinishDialog   = ref(false)

interface NearestCheckin { id: string; template_name: string; next_due_at: string }
const nearestCheckin = ref<NearestCheckin | null>(null)

const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,'
})

// ── Tap START on the today card ────────────────────────────────────────────
async function startTodayWorkout() {
  if (!trainerStore.todayTemplate || launching.value) return
  if (workout.hasActiveSession) {
    showConflictDialog.value = true
    return
  }
  await launchAssignedWorkout()
}

async function launchAssignedWorkout() {
  const t = trainerStore.todayTemplate
  if (!t) return
  launching.value = true
  try {
    await workout.startSession(t.template_name, t.template_id)
    router.push('/workout/active')
  } finally {
    launching.value = false
  }
}

// ── Conflict dialog handlers ───────────────────────────────────────────────
function continueExisting() {
  showConflictDialog.value = false
  router.push('/workout/active')
}

function openFinishDialog() {
  showConflictDialog.value = false
  showFinishDialog.value = true
}

function cancelFinish() {
  showFinishDialog.value = false
  showConflictDialog.value = true
}

async function saveAndStart() {
  showFinishDialog.value = false
  launching.value = true
  try {
    await workout.finishSession()
    const t = trainerStore.todayTemplate
    if (t) await workout.startSession(t.template_name, t.template_id)
    router.push('/workout/active')
  } finally {
    launching.value = false
  }
}

async function discardAndStart() {
  showFinishDialog.value = false
  launching.value = true
  try {
    await workout.discardSession()
    const t = trainerStore.todayTemplate
    if (t) await workout.startSession(t.template_name, t.template_id)
    router.push('/workout/active')
  } finally {
    launching.value = false
  }
}

async function enrichSessions() {
  recentWithMeta.value = await history.enrichSessions(history.sessions.slice(0, 5))
}

// ── Nearest pending check-in (banner shown below Today's Workout) ─────────
function formatCheckinDue(iso: string) {
  try { return format(new Date(iso), 'MMM d, yyyy') } catch { return '—' }
}

async function fetchNearestCheckin() {
  if (!auth.user?.id) return
  const endOfToday = new Date()
  endOfToday.setUTCHours(23, 59, 59, 999)

  const { data } = await supabase
    .from('checkin_assignments')
    .select('id, next_due_at, checkin_templates ( name )')
    .eq('client_id', auth.user.id)
    .eq('is_active', true)
    .not('next_due_at', 'is', null)
    .lte('next_due_at', endOfToday.toISOString())
    .order('next_due_at', { ascending: true })
    .limit(1)

  const row = data?.[0] as any
  nearestCheckin.value = row
    ? { id: row.id, next_due_at: row.next_due_at, template_name: row.checkin_templates?.name ?? 'Check-in' }
    : null
}

function openNearestCheckin() {
  if (!nearestCheckin.value) return
  router.push(`/checkin?assignment=${nearestCheckin.value.id}`)
}

async function verifyTrainerUpgradeIfNeeded() {
  if (route.query.upgraded !== '1' || !auth.user?.id) return
  const sessionId = route.query.session_id as string | undefined
  router.replace('/dashboard')
  if (!sessionId) { await auth.fetchProfile(auth.user.id); return }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-trainer-checkout`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ session_id: sessionId }),
    })
    if (res.ok) await auth.fetchProfile(auth.user.id)
  } catch (err) {
    console.error('verify-trainer-checkout failed:', err)
  }
}

onMounted(async () => {
  await verifyTrainerUpgradeIfNeeded()

  if (auth.user?.id) {
    history.subscribeToSessions(auth.user.id)
    await profileStore.fetchBodyweightLog(auth.user.id)
    // Only fetch today's plan template + check-ins for non-trainer users (clients)
    if (auth.profile?.role === 'user') {
      await trainerStore.fetchTodayTemplate()
      await fetchNearestCheckin()
    }
  }
  history.$subscribe(enrichSessions)
  await enrichSessions()
})
</script>

<style scoped>
.view { padding: 1.5rem 1rem 0; color: var(--text); font-family: 'DM Sans',sans-serif; background: var(--bg); min-height: 100vh; }
.view-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.greeting { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.2rem; }
.view-title { font-family: 'Barlow Condensed',sans-serif; font-size: 2rem; font-weight: 900; color: var(--text); line-height: 1; }
.header-badge { padding: 0.3rem 0.6rem; font-family: 'Barlow Condensed',sans-serif; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.2em; }
.header-badge.free  { background: var(--surface); color: var(--muted); }
.header-badge.paid  { background: rgba(74,158,255,0.1); color: var(--accent); border: 1px solid rgba(74,158,255,0.3); }
.header-badge.ultra { background: rgba(255,180,0,0.1); color: var(--gold); border: 1px solid rgba(255,180,0,0.3); }

/* Today's workout card */
.today-card {
  background: linear-gradient(135deg, rgba(74,158,255,0.15), rgba(74,158,255,0.05));
  border: 1px solid rgba(74,158,255,0.4);
  padding: 1.25rem; margin-bottom: 1.25rem; cursor: pointer;
  display: flex; flex-direction: column; gap: 0.25rem;
  position: relative; transition: border-color 0.15s;
}
.today-card:hover { border-color: rgba(74,158,255,0.7); }
.today-label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.6rem; font-weight: 700; color: var(--accent); letter-spacing: 0.2em; }
.today-name  { font-family: 'Barlow Condensed',sans-serif; font-size: 1.5rem; font-weight: 900; color: var(--text); line-height: 1; }
.today-plan  { font-size: 0.7rem; color: #AEAEB2; }
.today-btn {
  position: absolute; right: 1rem; top: 50%; transform: translateY(-50%);
  background: var(--accent); border: none; color: #fff;
  display: flex; align-items: center; gap: 0.35rem;
  padding: 0.5rem 0.875rem; font-family: 'Barlow Condensed',sans-serif;
  font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; cursor: pointer;
  transition: opacity 0.15s;
}
.today-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* Check-in due card */
.checkin-card {
  background: linear-gradient(135deg, rgba(255,180,0,0.15), rgba(255,180,0,0.05));
  border: 1px solid rgba(255,180,0,0.4);
  padding: 1.25rem; margin-bottom: 1.25rem; cursor: pointer;
  display: flex; flex-direction: column; gap: 0.25rem;
  position: relative; transition: border-color 0.15s;
}
.checkin-card:hover { border-color: rgba(255,180,0,0.7); }
.checkin-label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.6rem; font-weight: 700; color: var(--gold); letter-spacing: 0.2em; }
.checkin-name  { font-family: 'Barlow Condensed',sans-serif; font-size: 1.5rem; font-weight: 900; color: var(--text); line-height: 1; }
.checkin-due   { font-size: 0.7rem; color: #AEAEB2; }
.checkin-arrow {
  position: absolute; right: 1.25rem; top: 50%; transform: translateY(-50%);
  color: var(--gold); font-size: 0.9rem;
}

.dlg-body { font-size: 0.85rem; color: #AEAEB2; line-height: 1.55; }

.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 1.5rem; }
.section { margin-bottom: 1.5rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.see-all { font-size: 0.72rem; color: var(--accent); text-decoration: none; }
.chart-card { background: var(--bg); border: 1px solid var(--surface); padding: 1rem; }
.sessions-list { display: flex; flex-direction: column; gap: 0.5rem; }
.empty-state { text-align: center; padding: 2rem 1rem; color: var(--sub); }
.cta-btn { background: var(--accent); border: none; color: #fff; font-family: 'Barlow Condensed',sans-serif; font-weight: 700; letter-spacing: 0.1em; padding: 0.75rem 1.5rem; cursor: pointer; margin-top: 1rem; clip-path: var(--clip-sm); }
</style>
