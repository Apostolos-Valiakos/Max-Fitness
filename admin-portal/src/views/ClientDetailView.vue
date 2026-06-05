<template>
  <div class="page">
    <div v-if="loading" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading...</div>
    <div v-else>
      <!-- Header -->
      <div class="client-header">
        <router-link to="/users" class="back-link"><i class="pi pi-arrow-left" /> Users</router-link>
        <div class="client-hero">
          <img v-if="profile?.avatar_url" :src="profile.avatar_url" class="client-avatar-img" />
          <div v-else class="client-avatar">{{ avatarInitials }}</div>
          <div>
            <h1 class="page-title">{{ profile?.full_name ?? 'Unknown' }}</h1>
            <div class="client-meta">
              {{ email }} ·
              <span class="badge" :class="profile?.tier">{{ profile?.tier?.toUpperCase() }}</span> ·
              Joined {{ joinedDate }}
            </div>
          </div>
        </div>
      </div>

      <!-- KPI row -->
      <div class="kpi-row">
        <div class="kpi-card card">
          <div class="kpi-val">{{ totalSessions }}</div>
          <div class="kpi-label">Total Sessions</div>
        </div>
        <div class="kpi-card card">
          <div class="kpi-val">{{ totalVolume }}</div>
          <div class="kpi-label">Total Volume (kg)</div>
        </div>
        <div class="kpi-card card">
          <div class="kpi-val">{{ avgDuration }}</div>
          <div class="kpi-label">Avg Duration (min)</div>
        </div>
        <div class="kpi-card card">
          <div class="kpi-val">{{ daysSinceLast }}</div>
          <div class="kpi-label">Days Since Last Workout</div>
        </div>
      </div>

      <!-- Charts -->
      <div class="charts-row">
        <div class="card chart-panel">
          <div class="section-title">VOLUME PER WEEK (kg)</div>
          <div class="chart-wrap">
            <Bar :data="volumeChartData" :options="barOptions" />
          </div>
        </div>
        <div class="card chart-panel">
          <div class="section-title">SESSIONS PER WEEK</div>
          <div class="chart-wrap">
            <Bar :data="sessionsChartData" :options="barOptions" />
          </div>
        </div>
      </div>

      <!-- PRs + Sessions grid -->
      <div class="two-panel-row">
        <!-- PR Records -->
        <div class="card table-panel">
          <div class="section-title">PR RECORDS (best weight per rep count)</div>
          <table class="data-table">
            <thead><tr><th>Reps</th><th>Exercise</th><th>Weight (kg)</th><th>Est. 1RM</th></tr></thead>
            <tbody>
              <tr v-for="r in prRecords" :key="r.reps">
                <td class="td-reps">{{ r.reps }} RM</td>
                <td class="td-name">{{ r.exerciseName }}</td>
                <td class="td-val">{{ r.weight }}</td>
                <td class="td-val orange">{{ r.e1rm }}</td>
              </tr>
              <tr v-if="!prRecords.length"><td colspan="4" class="td-empty">No data</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Recent Sessions -->
        <div class="card table-panel">
          <div class="section-title">RECENT SESSIONS</div>
          <table class="data-table">
            <thead><tr><th>Workout</th><th>Duration</th><th>Sets</th><th>When</th></tr></thead>
            <tbody>
              <tr v-for="s in recentSessions" :key="s.id">
                <td class="td-name">{{ s.name }}</td>
                <td class="td-muted">{{ fmtDuration(s.started_at, s.finished_at) }}</td>
                <td class="td-val">{{ sessionSetCounts[s.id] ?? 0 }}</td>
                <td class="td-muted">{{ fmtDate(s.started_at) }}</td>
              </tr>
              <tr v-if="!recentSessions.length"><td colspan="4" class="td-empty">No sessions</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Body Measurements -->
      <div class="card table-panel" style="margin-top: 1rem">
        <div class="section-title">BODY MEASUREMENTS</div>
        <div v-if="!measurements.length" class="td-empty">No measurements logged</div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Weight</th><th>BF%</th>
              <th>Chest</th><th>Waist</th><th>Hips</th>
              <th>L.Arm</th><th>R.Arm</th><th>L.Thigh</th><th>R.Thigh</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in measurements" :key="m.id">
              <td class="td-muted">{{ m.measured_at }}</td>
              <td class="td-val">{{ m.weight_kg ?? '—' }}</td>
              <td class="td-val">{{ m.body_fat_pct != null ? m.body_fat_pct + '%' : '—' }}</td>
              <td class="td-muted">{{ m.chest_cm ?? '—' }}</td>
              <td class="td-muted">{{ m.waist_cm ?? '—' }}</td>
              <td class="td-muted">{{ m.hips_cm ?? '—' }}</td>
              <td class="td-muted">{{ m.left_arm_cm ?? '—' }}</td>
              <td class="td-muted">{{ m.right_arm_cm ?? '—' }}</td>
              <td class="td-muted">{{ m.left_thigh_cm ?? '—' }}</td>
              <td class="td-muted">{{ m.right_thigh_cm ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
import { adminSupabase } from '@/lib/adminSupabase'
import { format, subDays, eachWeekOfInterval, endOfWeek, differenceInDays } from 'date-fns'
import type { BodyMeasurement } from '@/lib/database.types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const route = useRoute()
const userId = computed(() => route.params.id as string)

const loading       = ref(true)
const profile       = ref<any>(null)
const email         = ref('')
const sessions      = ref<any[]>([])
const sets          = ref<any[]>([])
const measurements  = ref<BodyMeasurement[]>([])
const exerciseNames = ref<Record<string, string>>({})

const avatarInitials = computed(() => {
  const name = profile.value?.full_name ?? email.value ?? '?'
  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
})

const joinedDate = computed(() => profile.value ? format(new Date(profile.value.created_at), 'MMM d, yyyy') : '—')

const totalSessions = computed(() => sessions.value.length)

const totalVolume = computed(() => {
  const vol = sets.value.reduce((a, s) => a + ((s.weight_kg ?? 0) * (s.reps ?? 0)), 0)
  return Math.round(vol).toLocaleString()
})

const avgDuration = computed(() => {
  const finished = sessions.value.filter(s => s.finished_at)
  if (!finished.length) return '—'
  const total = finished.reduce((a, s) => {
    return a + (new Date(s.finished_at).getTime() - new Date(s.started_at).getTime())
  }, 0)
  return Math.round(total / finished.length / 60000)
})

const daysSinceLast = computed(() => {
  const last = sessions.value[0]
  if (!last) return '—'
  return differenceInDays(new Date(), new Date(last.started_at))
})

const recentSessions = computed(() => sessions.value.slice(0, 10))

const sessionSetCounts = computed(() => {
  const map: Record<string, number> = {}
  for (const s of sets.value) { map[s.session_id] = (map[s.session_id] ?? 0) + 1 }
  return map
})

// PR Records: best weight per rep count 1-12
const prRecords = computed(() => {
  const byReps: Record<number, { weight: number; exerciseId: string }> = {}
  for (const s of sets.value) {
    if (s.set_type !== 'working' || !s.reps || !s.weight_kg || s.reps < 1 || s.reps > 12) continue
    const reps = s.reps
    if (!byReps[reps] || s.weight_kg > byReps[reps].weight) {
      byReps[reps] = { weight: s.weight_kg, exerciseId: s.exercise_id }
    }
  }
  return Object.entries(byReps)
    .map(([reps, r]) => ({
      reps: Number(reps),
      weight: r.weight,
      exerciseName: exerciseNames.value[r.exerciseId] ?? r.exerciseId.slice(0, 8),
      e1rm: Math.round(r.weight * (1 + Number(reps) / 30) * 10) / 10,
    }))
    .sort((a, b) => a.reps - b.reps)
})

// Charts
const weeks = eachWeekOfInterval({ start: subDays(new Date(), 84), end: new Date() })
const weekLabels = weeks.map(w => format(w, 'MMM d'))

const volumeChartData = computed(() => {
  const data = weeks.map(w => {
    const end = endOfWeek(w)
    const weekSessions = sessions.value.filter(s => { const d = new Date(s.started_at); return d >= w && d <= end })
    const weekSessionIds = new Set(weekSessions.map(s => s.id))
    return sets.value.filter(s => weekSessionIds.has(s.session_id)).reduce((a, s) => a + ((s.weight_kg ?? 0) * (s.reps ?? 0)), 0)
  })
  return {
    labels: weekLabels,
    datasets: [{ label: 'Volume (kg)', data: data.map(v => Math.round(v)), backgroundColor: 'rgba(74,158,255,0.6)', borderColor: '#4A9EFF', borderWidth: 1, borderRadius: 3 }],
  }
})

const sessionsChartData = computed(() => {
  const data = weeks.map(w => {
    const end = endOfWeek(w)
    return sessions.value.filter(s => { const d = new Date(s.started_at); return d >= w && d <= end }).length
  })
  return {
    labels: weekLabels,
    datasets: [{ label: 'Sessions', data, backgroundColor: 'rgba(52,199,89,0.5)', borderColor: '#34C759', borderWidth: 1, borderRadius: 3 }],
  }
})

const barOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#636366', font: { size: 9 } }, grid: { color: '#252528' } },
    y: { ticks: { color: '#636366', font: { size: 9 } }, grid: { color: '#252528' } },
  },
}

function fmtDate(iso: string) { return format(new Date(iso), 'MMM d, yy') }
function fmtDuration(start: string, end: string | null) {
  if (!end) return '—'
  const m = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

onMounted(async () => {
  loading.value = true
  const uid = userId.value

  const [profileRes, authRes, sessRes, measRes] = await Promise.all([
    adminSupabase.from('profiles').select('*').eq('id', uid).single(),
    adminSupabase.auth.admin.getUserById(uid),
    adminSupabase.from('workout_sessions')
      .select('id, name, started_at, finished_at')
      .eq('user_id', uid).not('finished_at', 'is', null)
      .order('started_at', { ascending: false }).limit(100),
    adminSupabase.from('body_measurements').select('*').eq('user_id', uid)
      .order('measured_at', { ascending: false }).limit(20),
  ])

  profile.value      = profileRes.data
  email.value        = authRes.data.user?.email ?? ''
  sessions.value     = sessRes.data ?? []
  measurements.value = (measRes.data ?? []) as BodyMeasurement[]

  const sessionIds = sessions.value.map(s => s.id)
  if (sessionIds.length) {
    const { data: setsData } = await adminSupabase.from('sets')
      .select('id, session_id, exercise_id, set_type, weight_kg, reps')
      .in('session_id', sessionIds)
    sets.value = setsData ?? []

    // Load exercise names for PR table
    const exIds = [...new Set(sets.value.map(s => s.exercise_id))]
    if (exIds.length) {
      const { data: exData } = await adminSupabase.from('exercises').select('id, name').in('id', exIds)
      for (const e of exData ?? []) exerciseNames.value[e.id] = e.name
    }
  }

  loading.value = false
})
</script>

<style scoped>
.page { padding: 2rem; }
.loading-state { text-align: center; padding: 4rem; color: #636366; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }

.client-header { margin-bottom: 1.75rem; }
.back-link { font-family: 'Barlow Condensed', sans-serif; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; color: #636366; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem; margin-bottom: 0.75rem; transition: color 0.15s; }
.back-link:hover { color: #AEAEB2; }
.client-hero { display: flex; align-items: center; gap: 1.25rem; }
.client-avatar { width: 56px; height: 56px; background: #4A9EFF; display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed', sans-serif; font-size: 1.5rem; font-weight: 900; color: #fff; flex-shrink: 0; }
.client-avatar-img { width: 56px; height: 56px; object-fit: cover; flex-shrink: 0; }
.page-title { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: #F0F0F0; letter-spacing: 0.05em; line-height: 1; }
.client-meta { font-size: 0.78rem; color: #636366; margin-top: 0.3rem; display: flex; align-items: center; gap: 0.5rem; }

.badge { font-family: 'Barlow Condensed', sans-serif; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.1rem 0.4rem; border: 1px solid; }
.badge.free  { color: #636366; border-color: #3A3A3C; }
.badge.paid  { color: #4DA6FF; border-color: rgba(77,166,255,0.4); background: rgba(77,166,255,0.08); }
.badge.ultra { color: #FFD700; border-color: rgba(255,215,0,0.4); background: rgba(255,215,0,0.08); }

.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.kpi-card { padding: 1.25rem; }
.kpi-val  { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: #F0F0F0; line-height: 1; }
.kpi-label{ font-size: 0.67rem; color: #636366; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.35rem; }

.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
.chart-panel { padding: 1.25rem; }
.chart-wrap { height: 180px; margin-top: 0.75rem; }
.section-title { font-family: 'Barlow Condensed', sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; color: #636366; }

.two-panel-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.table-panel { padding: 1.25rem; }

.td-reps { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; color: #AEAEB2; font-size: 0.88rem; }
.td-name  { color: #C7C7CC; font-weight: 500; }
.td-muted { color: #636366; font-size: 0.78rem; }
.td-val   { color: #AEAEB2; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
.td-val.orange { color: #4A9EFF; }
.td-empty { color: #3A3A3C; font-size: 0.8rem; text-align: center; padding: 1.5rem; }
</style>
