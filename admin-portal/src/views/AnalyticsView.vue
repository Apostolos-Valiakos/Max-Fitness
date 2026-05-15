<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">ANALYTICS</h1>
      <div class="page-sub">Last 12 weeks</div>
    </div>

    <div v-if="loading" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading analytics...</div>

    <div v-else>
      <!-- KPI row -->
      <div class="kpi-row">
        <div class="kpi-card card">
          <div class="kpi-val">{{ totalSessions.toLocaleString() }}</div>
          <div class="kpi-label">Total Sessions</div>
        </div>
        <div class="kpi-card card">
          <div class="kpi-val">{{ totalVolume }}</div>
          <div class="kpi-label">Total Volume (kg)</div>
        </div>
        <div class="kpi-card card">
          <div class="kpi-val">{{ avgSetsPerSession }}</div>
          <div class="kpi-label">Avg Sets / Session</div>
        </div>
        <div class="kpi-card card">
          <div class="kpi-val">{{ activeUsersCount }}</div>
          <div class="kpi-label">Active Users (12w)</div>
        </div>
      </div>

      <!-- Charts row -->
      <div class="charts-row">
        <div class="card chart-panel">
          <div class="section-title">SESSIONS PER WEEK</div>
          <div class="chart-wrap">
            <Bar :data="sessionsChartData" :options="barOptions" />
          </div>
        </div>
        <div class="card chart-panel">
          <div class="section-title">NEW SIGN-UPS PER WEEK</div>
          <div class="chart-wrap">
            <Line :data="signupsChartData" :options="lineOptions" />
          </div>
        </div>
      </div>

      <!-- Top exercises -->
      <div class="card table-panel">
        <div class="section-title">TOP EXERCISES BY FREQUENCY (LAST 12 WEEKS)</div>
        <table class="data-table">
          <thead><tr><th>#</th><th>Exercise</th><th>Muscle Group</th><th>Sets Logged</th><th>Volume (kg)</th></tr></thead>
          <tbody>
            <tr v-for="(ex, i) in topExercises" :key="ex.id">
              <td class="td-rank">{{ i + 1 }}</td>
              <td class="td-name">{{ ex.name }}</td>
              <td><span class="chip-tag">{{ ex.body_part.replace('_', ' ') }}</span></td>
              <td class="td-val">{{ ex.sets.toLocaleString() }}</td>
              <td class="td-val">{{ Math.round(ex.volume).toLocaleString() }}</td>
            </tr>
            <tr v-if="topExercises.length === 0"><td colspan="5" class="td-empty">No data</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Bar, Line } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Filler } from 'chart.js'
import { supabase } from '@/lib/supabase'
import { listAuthUsers } from '@/lib/adminSupabase'
import { subDays, format, startOfWeek, eachWeekOfInterval, endOfWeek } from 'date-fns'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Filler)

const loading = ref(true)

const totalSessions     = ref(0)
const totalVolume       = ref('—')
const avgSetsPerSession = ref('—')
const activeUsersCount  = ref(0)
const topExercises      = ref<{ id: string; name: string; body_part: string; sets: number; volume: number }[]>([])

const sessionsChartData = ref<any>({ labels: [], datasets: [] })
const signupsChartData  = ref<any>({ labels: [], datasets: [] })

const chartBase = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
const barOptions  = { ...chartBase, scales: { x: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: '#1A1A1A' } }, y: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: '#1A1A1A' } } } }
const lineOptions = { ...chartBase, scales: { x: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: '#1A1A1A' } }, y: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: '#1A1A1A' } } } }

onMounted(async () => {
  loading.value = true
  const from = subDays(new Date(), 84)
  const fromISO = from.toISOString()
  const weeks   = eachWeekOfInterval({ start: from, end: new Date() })
  const weekLabels = weeks.map(w => format(w, 'MMM d'))

  // Sessions in range
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, user_id, started_at, finished_at')
    .gte('started_at', fromISO)
    .not('finished_at', 'is', null)

  totalSessions.value = sessions?.length ?? 0
  activeUsersCount.value = new Set(sessions?.map(s => s.user_id)).size

  // Sessions per week chart
  const sessWeekly = weeks.map((w: Date) => {
    const end = endOfWeek(w)
    return (sessions ?? []).filter((s: { started_at: string }) => { const d = new Date(s.started_at); return d >= w && d <= end }).length
  })
  sessionsChartData.value = {
    labels: weekLabels,
    datasets: [{ label: 'Sessions', data: sessWeekly, backgroundColor: 'rgba(255,77,0,0.6)', borderColor: '#FF4D00', borderWidth: 1, borderRadius: 3 }],
  }

  // Sets + volume
  const sessionIds = (sessions ?? []).map(s => s.id)
  if (sessionIds.length) {
    const { data: sets } = await supabase.from('sets').select('exercise_id, weight_kg, reps').in('session_id', sessionIds)
    const allSets = sets ?? []
    const vol = allSets.reduce((a, s) => a + ((s.weight_kg ?? 0) * (s.reps ?? 0)), 0)
    totalVolume.value = Math.round(vol).toLocaleString()
    avgSetsPerSession.value = totalSessions.value ? (allSets.length / totalSessions.value).toFixed(1) : '0'

    // Top exercises
    const exMap: Record<string, { sets: number; volume: number }> = {}
    for (const s of allSets) {
      if (!exMap[s.exercise_id]) exMap[s.exercise_id] = { sets: 0, volume: 0 }
      exMap[s.exercise_id].sets++
      exMap[s.exercise_id].volume += (s.weight_kg ?? 0) * (s.reps ?? 0)
    }

    const exIds = Object.keys(exMap)
    if (exIds.length) {
      const { data: exDocs } = await supabase.from('exercises').select('id, name, body_part').in('id', exIds)
      topExercises.value = (exDocs ?? [])
        .map(e => ({ ...e, ...exMap[e.id] }))
        .sort((a, b) => b.sets - a.sets)
        .slice(0, 15)
    }
  }

  // Sign-ups per week
  try {
    const authUsers = await listAuthUsers()
    const signupWeekly = weeks.map((w: Date) => {
      const end = endOfWeek(w)
      return authUsers.filter((u: { created_at: string }) => { const d = new Date(u.created_at); return d >= w && d <= end }).length
    })
    signupsChartData.value = {
      labels: weekLabels,
      datasets: [{ label: 'Sign-ups', data: signupWeekly, borderColor: '#FF4D00', backgroundColor: 'rgba(255,77,0,0.1)', tension: 0.4, fill: true, pointRadius: 3 }],
    }
  } catch {}

  loading.value = false
})
</script>

<style scoped>
.page { padding: 2rem; }
.page-header { margin-bottom: 2rem; }
.page-title { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: #F0F0F0; letter-spacing: 0.05em; }
.page-sub   { font-size: 0.75rem; color: #444; margin-top: 0.2rem; }

.loading-state { text-align: center; padding: 4rem; color: #444; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }

.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.kpi-card { padding: 1.25rem; }
.kpi-val  { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: #F0F0F0; line-height: 1; }
.kpi-label{ font-size: 0.68rem; color: #555; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.35rem; }

.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
.chart-panel { padding: 1.25rem; }
.chart-wrap { height: 200px; margin-top: 0.75rem; }

.table-panel { padding: 1.25rem; }
.td-rank { color: #444; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
.td-name { color: #C0C0C0; font-weight: 500; }
.td-val  { color: #888; font-family: 'Barlow Condensed', sans-serif; font-size: 0.95rem; font-weight: 700; }
.td-empty { color: #333; font-size: 0.8rem; text-align: center; padding: 2rem; }
.chip-tag { font-family: 'Barlow Condensed', sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; background: #1A1A1A; border: 1px solid #2A2A2A; color: #666; padding: 0.15rem 0.4rem; text-transform: uppercase; }
</style>
