<template>
  <div class="page">
    <div class="page-header"><h1 class="page-title">ANALYTICS</h1></div>

    <div class="tab-bar">
      <button v-for="t in TABS" :key="t.id" class="tab-btn" :class="{ active: activeTab === t.id }" @click="switchTab(t.id)">
        {{ t.label }}
      </button>
    </div>

    <div v-if="tabLoading" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading…</div>

    <template v-else>

      <!-- ── OVERVIEW ──────────────────────────────────────────────────── -->
      <div v-if="tabLoaded.overview" v-show="activeTab === 'overview'">
        <div class="kpi-row">
          <div class="kpi-card card"><div class="kpi-val">{{ ov.totalUsers }}</div><div class="kpi-label">Total Users</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ ov.totalSessions.toLocaleString() }}</div><div class="kpi-label">Sessions (12w)</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ ov.totalVolume }}</div><div class="kpi-label">Volume kg (12w)</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ ov.activeThisWeek }}</div><div class="kpi-label">Active This Week</div></div>
        </div>
        <div class="charts-row">
          <div class="card chart-panel">
            <div class="section-title">SESSIONS PER WEEK</div>
            <div class="chart-wrap"><Bar :data="ov.sessionsChart" :options="barOpts" /></div>
          </div>
          <div class="card chart-panel">
            <div class="section-title">NEW SIGNUPS PER WEEK</div>
            <div class="chart-wrap"><Line :data="ov.signupsChart" :options="lineOpts" /></div>
          </div>
        </div>
      </div>

      <!-- ── GROWTH ─────────────────────────────────────────────────────── -->
      <div v-if="tabLoaded.growth" v-show="activeTab === 'growth'">
        <div class="kpi-row">
          <div class="kpi-card card"><div class="kpi-val">{{ gr.newThisMonth }}</div><div class="kpi-label">New This Month</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ gr.active7 }}</div><div class="kpi-label">Active (7d)</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ gr.active30 }}</div><div class="kpi-label">Active (30d)</div></div>
          <div class="kpi-card card"><div class="kpi-val orange">{{ gr.churned }}</div><div class="kpi-label">Churned (30d+)</div></div>
        </div>
        <div class="charts-row">
          <div class="card chart-panel">
            <div class="section-title">SIGNUPS PER MONTH (12M)</div>
            <div class="chart-wrap"><Bar :data="gr.signupsByMonth" :options="barOpts" /></div>
          </div>
          <div class="card chart-panel">
            <div class="section-title">TIER DISTRIBUTION</div>
            <div class="chart-wrap"><Bar :data="gr.tierChart" :options="barOptsStacked" /></div>
          </div>
        </div>
        <div class="card table-panel">
          <div class="section-title">RETENTION SUMMARY</div>
          <table class="data-table">
            <thead><tr><th>Window</th><th>Trained At Least Once</th><th>% of Total Users</th></tr></thead>
            <tbody>
              <tr><td class="td-name">Last 7 days</td><td class="td-val">{{ gr.active7 }}</td><td class="td-muted">{{ pct(gr.active7, ov.totalUsers) }}%</td></tr>
              <tr><td class="td-name">Last 30 days</td><td class="td-val">{{ gr.active30 }}</td><td class="td-muted">{{ pct(gr.active30, ov.totalUsers) }}%</td></tr>
              <tr><td class="td-name">Last 90 days</td><td class="td-val">{{ gr.active90 }}</td><td class="td-muted">{{ pct(gr.active90, ov.totalUsers) }}%</td></tr>
              <tr><td class="td-name">Never trained</td><td class="td-val orange">{{ gr.neverTrained }}</td><td class="td-muted">{{ pct(gr.neverTrained, ov.totalUsers) }}%</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── REVENUE ─────────────────────────────────────────────────────── -->
      <div v-if="tabLoaded.revenue" v-show="activeTab === 'revenue'">
        <div class="kpi-row">
          <div class="kpi-card card"><div class="kpi-val green">€{{ rv.mrr.toLocaleString() }}</div><div class="kpi-label">Est. MRR</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ rv.ultraCount }}</div><div class="kpi-label">Ultra (€30/mo)</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ rv.paidCount }}</div><div class="kpi-label">Paid (€5/mo)</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ rv.freeCount }}</div><div class="kpi-label">Free</div></div>
        </div>
        <div class="charts-row">
          <div class="card chart-panel">
            <div class="section-title">USERS BY TIER</div>
            <div class="chart-wrap"><Bar :data="rv.tierChart" :options="barOpts" /></div>
          </div>
          <div class="card chart-panel">
            <div class="section-title">REVENUE BREAKDOWN</div>
            <div class="chart-wrap"><Bar :data="rv.revenueChart" :options="barOpts" /></div>
          </div>
        </div>
        <div class="card table-panel">
          <div class="section-title">TIER SUMMARY</div>
          <table class="data-table">
            <thead><tr><th>Tier</th><th>Users</th><th>Price</th><th>Monthly Revenue</th><th>% of Users</th></tr></thead>
            <tbody>
              <tr>
                <td><span class="badge ultra">ULTRA</span></td>
                <td class="td-val">{{ rv.ultraCount }}</td>
                <td class="td-muted">€30</td>
                <td class="td-val green">€{{ (rv.ultraCount * 30).toLocaleString() }}</td>
                <td class="td-muted">{{ pct(rv.ultraCount, ov.totalUsers) }}%</td>
              </tr>
              <tr>
                <td><span class="badge paid">PAID</span></td>
                <td class="td-val">{{ rv.paidCount }}</td>
                <td class="td-muted">€5</td>
                <td class="td-val green">€{{ (rv.paidCount * 5).toLocaleString() }}</td>
                <td class="td-muted">{{ pct(rv.paidCount, ov.totalUsers) }}%</td>
              </tr>
              <tr>
                <td><span class="badge free">FREE</span></td>
                <td class="td-val">{{ rv.freeCount }}</td>
                <td class="td-muted">€0</td>
                <td class="td-val">€0</td>
                <td class="td-muted">{{ pct(rv.freeCount, ov.totalUsers) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── ENGAGEMENT ──────────────────────────────────────────────────── -->
      <div v-if="tabLoaded.engagement" v-show="activeTab === 'engagement'">
        <div class="kpi-row">
          <div class="kpi-card card"><div class="kpi-val">{{ eg.avgDuration }}<span class="kpi-unit">min</span></div><div class="kpi-label">Avg Session Duration</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ eg.avgSets }}</div><div class="kpi-label">Avg Sets / Session</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ eg.peakDay }}</div><div class="kpi-label">Most Active Day</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ eg.peakHour }}</div><div class="kpi-label">Peak Training Hour</div></div>
        </div>
        <div class="card chart-panel" style="margin-bottom:1rem">
          <div class="section-title">SESSIONS PER DAY (84 DAYS)</div>
          <div class="chart-wrap chart-tall"><Bar :data="eg.dailyChart" :options="barOptsThin" /></div>
        </div>
        <div class="charts-row">
          <div class="card chart-panel">
            <div class="section-title">SESSIONS BY DAY OF WEEK</div>
            <div class="chart-wrap"><Bar :data="eg.dowChart" :options="barOpts" /></div>
          </div>
          <div class="card chart-panel">
            <div class="section-title">AVG DURATION PER WEEK (min)</div>
            <div class="chart-wrap"><Line :data="eg.durationChart" :options="lineOpts" /></div>
          </div>
        </div>
      </div>

      <!-- ── TRAINERS ────────────────────────────────────────────────────── -->
      <div v-if="tabLoaded.trainers" v-show="activeTab === 'trainers'">
        <div class="kpi-row">
          <div class="kpi-card card"><div class="kpi-val">{{ tr.totalTrainers }}</div><div class="kpi-label">Trainers</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ tr.totalClients }}</div><div class="kpi-label">Active Clients</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ tr.avgClientsPerTrainer }}</div><div class="kpi-label">Avg Clients / Trainer</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ tr.overallCompletionPct }}%</div><div class="kpi-label">Check-in Completion</div></div>
        </div>
        <div class="card table-panel" style="margin-bottom:1rem">
          <div class="section-title">TRAINER PERFORMANCE</div>
          <table class="data-table">
            <thead><tr><th>Trainer</th><th>Clients</th><th>Check-ins Assigned</th><th>Submitted</th><th>Rate</th><th>Avg Reply</th></tr></thead>
            <tbody>
              <tr v-for="t in tr.rows" :key="t.id">
                <td class="td-name">{{ t.full_name ?? '—' }}</td>
                <td class="td-val">{{ t.clientCount }}</td>
                <td class="td-muted">{{ t.assigned }}</td>
                <td class="td-muted">{{ t.submitted }}</td>
                <td class="td-val" :class="t.rate >= 80 ? 'green' : t.rate >= 50 ? '' : 'orange'">{{ t.rate }}%</td>
                <td class="td-muted">{{ t.avgReply }}</td>
              </tr>
              <tr v-if="!tr.rows.length"><td colspan="6" class="td-empty">No trainers</td></tr>
            </tbody>
          </table>
        </div>
        <div class="card table-panel">
          <div class="section-title">OVERDUE UNANSWERED CHECK-INS</div>
          <table class="data-table">
            <thead><tr><th>Trainer</th><th>Submitted</th><th>Waiting Since</th></tr></thead>
            <tbody>
              <tr v-for="s in tr.overdue" :key="s.id">
                <td class="td-name">{{ s.trainerName }}</td>
                <td class="td-muted">{{ fmtDate(s.created_at, 'MMM d, yy') }}</td>
                <td class="td-val orange">{{ s.waitDays }}d</td>
              </tr>
              <tr v-if="!tr.overdue.length"><td colspan="3" class="td-empty" style="color:#2EAF52">All caught up</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── CONTENT ─────────────────────────────────────────────────────── -->
      <div v-if="tabLoaded.content" v-show="activeTab === 'content'">
        <div class="kpi-row">
          <div class="kpi-card card"><div class="kpi-val">{{ ct.templateCount }}</div><div class="kpi-label">Total Templates</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ ct.totalSessionsAllTime.toLocaleString() }}</div><div class="kpi-label">Sessions (All Time)</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ ct.customExCount }}</div><div class="kpi-label">Custom Exercises</div></div>
          <div class="kpi-card card"><div class="kpi-val">{{ ct.globalExCount }}</div><div class="kpi-label">Global Exercises</div></div>
        </div>
        <div class="charts-row">
          <div class="card table-panel">
            <div class="section-title">TOP TEMPLATES BY USAGE</div>
            <table class="data-table">
              <thead><tr><th>#</th><th>Template</th><th>Sessions</th></tr></thead>
              <tbody>
                <tr v-for="(t, i) in ct.topTemplates" :key="t.id">
                  <td class="td-rank">{{ i + 1 }}</td>
                  <td class="td-name">{{ t.name }}</td>
                  <td class="td-val">{{ t.count }}</td>
                </tr>
                <tr v-if="!ct.topTemplates.length"><td colspan="3" class="td-empty">No data</td></tr>
              </tbody>
            </table>
          </div>
          <div class="card chart-panel">
            <div class="section-title">SETS BY MUSCLE GROUP (12W)</div>
            <div class="chart-wrap"><Bar :data="ct.muscleChart" :options="barOptsH" /></div>
          </div>
        </div>
        <div class="card table-panel">
          <div class="section-title">TOP EXERCISES BY SETS (12W)</div>
          <table class="data-table">
            <thead><tr><th>#</th><th>Exercise</th><th>Muscle Group</th><th>Sets</th><th>Volume (kg)</th></tr></thead>
            <tbody>
              <tr v-for="(ex, i) in ct.topExercises" :key="ex.id">
                <td class="td-rank">{{ i + 1 }}</td>
                <td class="td-name">{{ ex.name }}</td>
                <td><span class="chip-tag">{{ ex.body_part.replace('_', ' ') }}</span></td>
                <td class="td-val">{{ ex.sets.toLocaleString() }}</td>
                <td class="td-val">{{ Math.round(ex.volume).toLocaleString() }}</td>
              </tr>
              <tr v-if="!ct.topExercises.length"><td colspan="5" class="td-empty">No data</td></tr>
            </tbody>
          </table>
        </div>
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Bar, Line } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, Tooltip, Filler,
} from 'chart.js'
import { adminSupabase } from '@/lib/adminSupabase'
import { useAuthUsers } from '@/composables/useAuthUsers'
import { subDays, subMonths, format, startOfMonth, endOfMonth, eachWeekOfInterval, endOfWeek, eachMonthOfInterval, differenceInDays } from 'date-fns'
import { fmtDate } from '@/lib/utils'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Filler)

// ── Chart option presets ────────────────────────────────────────────────────
const tickStyle = { color: '#636366', font: { size: 9 } }
const gridStyle = { color: '#252528' }
const baseOpts  = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
const barOpts   = { ...baseOpts, scales: { x: { ticks: tickStyle, grid: gridStyle }, y: { ticks: tickStyle, grid: gridStyle } } }
const barOptsThin = { ...barOpts, datasets: { bar: { borderRadius: 1 } } } as any
const lineOpts  = { ...baseOpts, scales: { x: { ticks: tickStyle, grid: gridStyle }, y: { ticks: tickStyle, grid: gridStyle } } }
const barOptsStacked = { ...baseOpts, scales: { x: { stacked: true, ticks: tickStyle, grid: gridStyle }, y: { stacked: true, ticks: tickStyle, grid: gridStyle } } }
const barOptsH  = { ...baseOpts, indexAxis: 'y' as const, scales: { x: { ticks: tickStyle, grid: gridStyle }, y: { ticks: { ...tickStyle, font: { size: 8 } }, grid: gridStyle } } }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}:00`)

// ── Tabs ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',   label: 'OVERVIEW'   },
  { id: 'growth',     label: 'GROWTH'     },
  { id: 'revenue',    label: 'REVENUE'    },
  { id: 'engagement', label: 'ENGAGEMENT' },
  { id: 'trainers',   label: 'TRAINERS'   },
  { id: 'content',    label: 'CONTENT'    },
]

const activeTab  = ref('overview')
const tabLoading = ref(false)
const tabLoaded  = reactive({ overview: false, growth: false, revenue: false, engagement: false, trainers: false, content: false })

const { authUsers, fetchAuthUsers } = useAuthUsers()

// ── Shared data (loaded with overview) ──────────────────────────────────────
const allProfiles  = ref<any[]>([])
const sessions84   = ref<any[]>([])
const sets84       = ref<any[]>([])
const exMeta84     = ref<Record<string, { name: string; body_part: string }>>({})

// ── Per-tab data ─────────────────────────────────────────────────────────────
const ov = reactive({
  totalUsers: 0, totalSessions: 0, totalVolume: '—', activeThisWeek: 0,
  sessionsChart: { labels: [] as string[], datasets: [] as any[] },
  signupsChart:  { labels: [] as string[], datasets: [] as any[] },
})

const gr = reactive({
  newThisMonth: 0, active7: 0, active30: 0, active90: 0, churned: 0, neverTrained: 0,
  signupsByMonth: { labels: [] as string[], datasets: [] as any[] },
  tierChart:     { labels: [] as string[], datasets: [] as any[] },
})

const rv = reactive({ mrr: 0, ultraCount: 0, paidCount: 0, freeCount: 0,
  tierChart:    { labels: [] as string[], datasets: [] as any[] },
  revenueChart: { labels: [] as string[], datasets: [] as any[] },
})

const eg = reactive({
  avgDuration: '—', avgSets: '—', peakDay: '—', peakHour: '—',
  dailyChart:    { labels: [] as string[], datasets: [] as any[] },
  dowChart:      { labels: [] as string[], datasets: [] as any[] },
  durationChart: { labels: [] as string[], datasets: [] as any[] },
})

const tr = reactive({
  totalTrainers: 0, totalClients: 0, avgClientsPerTrainer: '—', overallCompletionPct: 0,
  rows: [] as any[],
  overdue: [] as any[],
})

const ct = reactive({
  templateCount: 0, totalSessionsAllTime: 0, customExCount: 0, globalExCount: 0,
  topTemplates: [] as any[],
  topExercises: [] as any[],
  muscleChart: { labels: [] as string[], datasets: [] as any[] },
})

// ── Helpers ─────────────────────────────────────────────────────────────────
function pct(n: number, total: number) { return total ? Math.round(n / total * 100) : 0 }

function makeBar(labels: string[], data: number[], color: string) {
  return { labels, datasets: [{ data, backgroundColor: color + 'aa', borderColor: color, borderWidth: 1, borderRadius: 3 }] }
}
function makeLine(labels: string[], data: number[], color: string) {
  return { labels, datasets: [{ data, borderColor: color, backgroundColor: color + '22', tension: 0.4, fill: true, pointRadius: 2 }] }
}

// ── Load: OVERVIEW ───────────────────────────────────────────────────────────
async function loadOverview() {
  const now  = new Date()
  const from = subDays(now, 84)
  const weeks = eachWeekOfInterval({ start: from, end: now })
  const weekLabels = weeks.map(w => format(w, 'MMM d'))

  const [profilesRes, , sessRes] = await Promise.all([
    adminSupabase.from('profiles').select('id, tier, role, created_at'),
    fetchAuthUsers().catch(() => {}),
    adminSupabase.from('workout_sessions').select('id, user_id, started_at, finished_at')
      .gte('started_at', from.toISOString()).not('finished_at', 'is', null),
  ])

  allProfiles.value = profilesRes.data ?? []
  sessions84.value  = sessRes.data ?? []

  // Load sets for those sessions
  const ids = sessions84.value.map(s => s.id)
  if (ids.length) {
    const { data: setsData } = await adminSupabase.from('sets')
      .select('session_id, exercise_id, weight_kg, reps').in('session_id', ids)
    sets84.value = setsData ?? []

    const exIds = [...new Set(sets84.value.map(s => s.exercise_id))]
    if (exIds.length) {
      const { data: exData } = await adminSupabase.from('exercises').select('id, name, body_part').in('id', exIds)
      for (const e of exData ?? []) exMeta84.value[e.id] = { name: e.name, body_part: e.body_part }
    }
  }

  // Overview KPIs
  ov.totalUsers    = allProfiles.value.length
  ov.totalSessions = sessions84.value.length
  const vol = sets84.value.reduce((a, s) => a + (s.weight_kg ?? 0) * (s.reps ?? 0), 0)
  ov.totalVolume   = Math.round(vol).toLocaleString()
  const from7 = subDays(now, 7).toISOString()
  ov.activeThisWeek = new Set(sessions84.value.filter(s => s.started_at >= from7).map(s => s.user_id)).size

  // Sessions per week
  const sessWeekly = weeks.map(w => {
    const end = endOfWeek(w)
    return sessions84.value.filter(s => s.started_at >= w.toISOString() && s.started_at <= end.toISOString()).length
  })
  ov.sessionsChart = makeBar(weekLabels, sessWeekly, '#4A9EFF')

  // Signups per week from authUsers
  const signupWeekly = weeks.map(w => {
    const end = endOfWeek(w).toISOString()
    return authUsers.value.filter(u => u.created_at >= w.toISOString() && u.created_at <= end).length
  })
  ov.signupsChart = makeLine(weekLabels, signupWeekly, '#4A9EFF')

  tabLoaded.overview = true
}

// ── Load: GROWTH ─────────────────────────────────────────────────────────────
async function loadGrowth() {
  const now   = new Date()
  const from7  = subDays(now, 7).toISOString()
  const from30 = subDays(now, 30).toISOString()
  const from90 = subDays(now, 90).toISOString()

  const [s7Res, s30Res, s90Res, everRes] = await Promise.all([
    adminSupabase.from('workout_sessions').select('user_id').gte('started_at', from7).not('finished_at', 'is', null),
    adminSupabase.from('workout_sessions').select('user_id').gte('started_at', from30).not('finished_at', 'is', null),
    adminSupabase.from('workout_sessions').select('user_id').gte('started_at', from90).not('finished_at', 'is', null),
    adminSupabase.from('workout_sessions').select('user_id').lt('started_at', from30).not('finished_at', 'is', null),
  ])

  const active7Set  = new Set((s7Res.data ?? []).map(s => s.user_id))
  const active30Set = new Set((s30Res.data ?? []).map(s => s.user_id))
  const active90Set = new Set((s90Res.data ?? []).map(s => s.user_id))
  const everSet     = new Set((everRes.data ?? []).map(s => s.user_id))

  gr.active7  = active7Set.size
  gr.active30 = active30Set.size
  gr.active90 = active90Set.size
  gr.churned  = [...everSet].filter(id => !active30Set.has(id)).length
  gr.neverTrained = allProfiles.value.filter(p => !active90Set.has(p.id) && !everSet.has(p.id)).length

  const thisMonth = startOfMonth(now)
  gr.newThisMonth = authUsers.value.filter(u => u.created_at >= thisMonth.toISOString()).length

  // Signups by month (last 12 months)
  const months = eachMonthOfInterval({ start: subMonths(now, 11), end: now })
  const monthLabels = months.map(m => format(m, 'MMM yy'))
  const signupsByMonth = months.map(m => {
    const end = endOfMonth(m).toISOString()
    return authUsers.value.filter(u => u.created_at >= m.toISOString() && u.created_at <= end).length
  })
  gr.signupsByMonth = makeBar(monthLabels, signupsByMonth, '#4A9EFF')

  // Tier distribution stacked bar (snapshot)
  const freeCount  = allProfiles.value.filter(p => p.tier === 'free').length
  const paidCount  = allProfiles.value.filter(p => p.tier === 'paid').length
  const ultraCount = allProfiles.value.filter(p => p.tier === 'ultra').length
  gr.tierChart = {
    labels: ['Users'],
    datasets: [
      { label: 'Free',  data: [freeCount],  backgroundColor: '#3A3A3C', borderColor: '#636366', borderWidth: 1 },
      { label: 'Paid',  data: [paidCount],  backgroundColor: 'rgba(77,166,255,0.7)', borderColor: '#4DA6FF', borderWidth: 1 },
      { label: 'Ultra', data: [ultraCount], backgroundColor: 'rgba(255,215,0,0.7)',   borderColor: '#FFD700', borderWidth: 1 },
    ],
  }

  tabLoaded.growth = true
}

// ── Load: REVENUE ─────────────────────────────────────────────────────────────
function loadRevenue() {
  rv.freeCount  = allProfiles.value.filter(p => p.tier === 'free').length
  rv.paidCount  = allProfiles.value.filter(p => p.tier === 'paid').length
  rv.ultraCount = allProfiles.value.filter(p => p.tier === 'ultra').length
  rv.mrr        = rv.paidCount * 5 + rv.ultraCount * 30

  rv.tierChart = makeBar(
    ['Free', 'Paid', 'Ultra'],
    [rv.freeCount, rv.paidCount, rv.ultraCount],
    '#4A9EFF',
  )
  rv.tierChart.datasets[0].backgroundColor = ['#3A3A3C', 'rgba(77,166,255,0.7)', 'rgba(255,215,0,0.7)'] as any
  rv.tierChart.datasets[0].borderColor     = ['#636366', '#4DA6FF', '#FFD700'] as any

  rv.revenueChart = makeBar(
    ['Paid (€5)', 'Ultra (€30)'],
    [rv.paidCount * 5, rv.ultraCount * 30],
    '#34C759',
  )

  tabLoaded.revenue = true
}

// ── Load: ENGAGEMENT ─────────────────────────────────────────────────────────
function loadEngagement() {
  const now  = new Date()
  const from = subDays(now, 84)
  const weeks = eachWeekOfInterval({ start: from, end: now })
  const weekLabels = weeks.map(w => format(w, 'MMM d'))

  // Avg duration
  const finished = sessions84.value.filter(s => s.finished_at)
  if (finished.length) {
    const totalMs = finished.reduce((a, s) =>
      a + (new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()), 0)
    eg.avgDuration = Math.round(totalMs / finished.length / 60000).toString()
  }

  // Avg sets
  if (sessions84.value.length) {
    eg.avgSets = (sets84.value.length / sessions84.value.length).toFixed(1)
  }

  // Day of week
  const dowCounts = Array(7).fill(0)
  for (const s of sessions84.value) dowCounts[new Date(s.started_at).getDay()]++
  const peakDowIdx = dowCounts.indexOf(Math.max(...dowCounts))
  eg.peakDay = DAYS[peakDowIdx]
  eg.dowChart = makeBar(DAYS, dowCounts, '#4A9EFF')

  // Hour of day peak
  const hourCounts = Array(24).fill(0)
  for (const s of sessions84.value) hourCounts[new Date(s.started_at).getHours()]++
  const peakHourIdx = hourCounts.indexOf(Math.max(...hourCounts))
  eg.peakHour = `${peakHourIdx}:00`

  // Sessions per day
  const days: string[] = []
  const dayCounts: number[] = []
  const dayMap: Record<string, number> = {}
  for (const s of sessions84.value) {
    const d = s.started_at.slice(0, 10)
    dayMap[d] = (dayMap[d] ?? 0) + 1
  }
  let cursor = new Date(from)
  while (cursor <= now) {
    const key = cursor.toISOString().slice(0, 10)
    days.push(format(cursor, 'MMM d'))
    dayCounts.push(dayMap[key] ?? 0)
    cursor = new Date(cursor.getTime() + 86400000)
  }
  eg.dailyChart = makeBar(days, dayCounts, '#4A9EFF')

  // Avg duration per week
  const durationWeekly = weeks.map(w => {
    const end = endOfWeek(w)
    const wSess = sessions84.value.filter(s =>
      s.finished_at && s.started_at >= w.toISOString() && s.started_at <= end.toISOString()
    )
    if (!wSess.length) return 0
    const ms = wSess.reduce((a, s) =>
      a + (new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()), 0)
    return Math.round(ms / wSess.length / 60000)
  })
  eg.durationChart = makeLine(weekLabels, durationWeekly, '#34C759')

  tabLoaded.engagement = true
}

// ── Load: TRAINERS ────────────────────────────────────────────────────────────
async function loadTrainers() {
  const trainerProfiles = allProfiles.value.filter(p => p.role === 'trainer' || p.role === 'admin')
  const trainerIds = trainerProfiles.map(p => p.id)
  if (!trainerIds.length) {
    tr.rows = []; tr.overdue = []; tabLoaded.trainers = true; return
  }

  const nameMap: Record<string, string> = {}
  for (const p of allProfiles.value) if (p.role === 'trainer' || p.role === 'admin') nameMap[p.id] = p.full_name ?? '—'

  const [assignRes, caRes, subRes] = await Promise.all([
    adminSupabase.from('trainer_assignments').select('trainer_id, client_id').eq('is_active', true),
    adminSupabase.from('checkin_assignments').select('id, trainer_id').eq('is_active', true),
    adminSupabase.from('checkin_submissions').select('id, trainer_id, created_at, trainer_replied_at, trainer_reply'),
  ])

  const assignments   = assignRes.data ?? []
  const caAssignments = caRes.data ?? []
  const submissions   = subRes.data ?? []

  let totalSub = 0, totalAssigned = 0

  tr.rows = trainerProfiles.map(p => {
    const clientCount = assignments.filter(a => a.trainer_id === p.id).length
    const assigned    = caAssignments.filter(a => a.trainer_id === p.id).length
    const subs        = submissions.filter(s => s.trainer_id === p.id)
    const submitted   = subs.length
    const rate        = assigned ? Math.round(submitted / assigned * 100) : 0
    totalSub     += submitted
    totalAssigned += assigned

    const replied  = subs.filter(s => s.trainer_replied_at)
    let avgReply   = '—'
    if (replied.length) {
      const avgMs = replied.reduce((a, s) =>
        a + (new Date(s.trainer_replied_at).getTime() - new Date(s.created_at).getTime()), 0) / replied.length
      const mins = Math.round(avgMs / 60000)
      avgReply = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins/60)}h` : `${Math.round(mins/1440)}d`
    }

    return { id: p.id, full_name: p.full_name, clientCount, assigned, submitted, rate, avgReply }
  })

  tr.totalTrainers         = trainerProfiles.length
  tr.totalClients          = new Set(assignments.map(a => a.client_id)).size
  tr.avgClientsPerTrainer  = trainerProfiles.length ? (tr.totalClients / trainerProfiles.length).toFixed(1) : '—'
  tr.overallCompletionPct  = totalAssigned ? Math.round(totalSub / totalAssigned * 100) : 0

  // Overdue: submissions without a reply, older than 24h
  const cutoff = subDays(new Date(), 1)
  tr.overdue = submissions
    .filter(s => !s.trainer_reply && new Date(s.created_at) < cutoff)
    .map(s => ({
      id: s.id,
      trainerName: nameMap[s.trainer_id] ?? '—',
      created_at: s.created_at,
      waitDays: differenceInDays(new Date(), new Date(s.created_at)),
    }))
    .sort((a, b) => b.waitDays - a.waitDays)

  tabLoaded.trainers = true
}

// ── Load: CONTENT ─────────────────────────────────────────────────────────────
async function loadContent() {
  const [allSessRes, templatesRes, exercisesRes] = await Promise.all([
    adminSupabase.from('workout_sessions').select('template_id').not('template_id', 'is', null),
    adminSupabase.from('workout_templates').select('id, name, owner_id, is_public'),
    adminSupabase.from('exercises').select('id, name, body_part, created_by'),
  ])

  const allSess  = allSessRes.data ?? []
  const templates = templatesRes.data ?? []
  const exercises = exercisesRes.data ?? []

  ct.totalSessionsAllTime = allSess.length + sessions84.value.filter(s => !s.template_id).length
  ct.templateCount  = templates.length
  ct.customExCount  = exercises.filter(e => e.created_by !== null).length
  ct.globalExCount  = exercises.filter(e => e.created_by === null).length

  // Template usage
  const usageMap: Record<string, number> = {}
  for (const s of allSess) usageMap[s.template_id] = (usageMap[s.template_id] ?? 0) + 1
  ct.topTemplates = templates
    .map(t => ({ id: t.id, name: t.name, count: usageMap[t.id] ?? 0 }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Top exercises (from sets84)
  const exMap: Record<string, { sets: number; volume: number }> = {}
  for (const s of sets84.value) {
    if (!exMap[s.exercise_id]) exMap[s.exercise_id] = { sets: 0, volume: 0 }
    exMap[s.exercise_id].sets++
    exMap[s.exercise_id].volume += (s.weight_kg ?? 0) * (s.reps ?? 0)
  }
  ct.topExercises = Object.entries(exMap)
    .map(([id, stats]) => ({
      id, ...stats,
      name:      exMeta84.value[id]?.name      ?? 'Custom',
      body_part: exMeta84.value[id]?.body_part ?? 'other',
    }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 15)

  // Sets by muscle group (horizontal bar)
  const muscleMap: Record<string, number> = {}
  for (const s of sets84.value) {
    const bp = exMeta84.value[s.exercise_id]?.body_part ?? 'other'
    muscleMap[bp] = (muscleMap[bp] ?? 0) + 1
  }
  const muscleEntries = Object.entries(muscleMap).sort((a, b) => b[1] - a[1])
  ct.muscleChart = {
    labels: muscleEntries.map(([k]) => k.replace('_', ' ')),
    datasets: [{
      data: muscleEntries.map(([, v]) => v),
      backgroundColor: 'rgba(74,158,255,0.6)',
      borderColor: '#4A9EFF',
      borderWidth: 1,
      borderRadius: 3,
    }],
  }

  tabLoaded.content = true
}

// ── Tab switching ─────────────────────────────────────────────────────────────
async function switchTab(id: string) {
  activeTab.value = id
  if (tabLoaded[id as keyof typeof tabLoaded]) return
  tabLoading.value = true
  if (id === 'growth')     await loadGrowth()
  if (id === 'revenue')    loadRevenue()
  if (id === 'engagement') loadEngagement()
  if (id === 'trainers')   await loadTrainers()
  if (id === 'content')    await loadContent()
  tabLoading.value = false
}

onMounted(async () => {
  tabLoading.value = true
  await loadOverview()
  tabLoading.value = false
})
</script>

<style scoped>
/* Tab bar */
.tab-bar { display: flex; gap: 0; margin-bottom: 1.75rem; border-bottom: 1px solid #252528; }
.tab-btn {
  background: none; border: none; border-bottom: 2px solid transparent;
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.78rem; font-weight: 700;
  letter-spacing: 0.15em; color: #636366; padding: 0.6rem 1rem; cursor: pointer;
  transition: color 0.15s, border-color 0.15s; margin-bottom: -1px;
}
.tab-btn:hover  { color: #AEAEB2; }
.tab-btn.active { color: #4A9EFF; border-bottom-color: #4A9EFF; }

/* KPIs */
.kpi-row  { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.kpi-card { padding: 1.25rem; }
.kpi-val  { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: #F0F0F0; line-height: 1; }
.kpi-unit { font-size: 1rem; margin-left: 0.2rem; }
.kpi-label{ font-size: 0.67rem; color: #636366; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.35rem; }

/* Charts */
.charts-row  { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
.chart-panel { padding: 1.25rem; }
.chart-wrap  { height: 200px; margin-top: 0.75rem; }
.chart-tall  { height: 160px; }

/* Tables */
.table-panel { padding: 1.25rem; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 0.75rem; }
.data-table th { font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; color: #636366; padding: 0 0.5rem 0.6rem; text-align: left; border-bottom: 1px solid #252528; }
.data-table td { padding: 0.55rem 0.5rem; border-bottom: 1px solid #1C1C1E; vertical-align: middle; }

.section-title { font-family: 'Barlow Condensed', sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; color: #636366; }
.td-rank  { color: #636366; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
.td-name  { color: #C7C7CC; font-weight: 500; }
.td-muted { color: #636366; font-size: 0.78rem; }
.td-val   { color: #AEAEB2; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
.td-empty { color: #3A3A3C; font-size: 0.8rem; text-align: center; padding: 1.5rem; }

.orange { color: #4A9EFF; }
.green  { color: #34C759; }

.chip-tag { font-family: 'Barlow Condensed', sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; background: #252528; border: 1px solid #3A3A3C; color: #8E8E93; padding: 0.15rem 0.4rem; text-transform: uppercase; }

.badge { font-family: 'Barlow Condensed', sans-serif; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.1rem 0.4rem; border: 1px solid; }
.badge.free  { color: #636366; border-color: #3A3A3C; }
.badge.paid  { color: #4DA6FF; border-color: rgba(77,166,255,0.4); background: rgba(77,166,255,0.08); }
.badge.ultra { color: #FFD700; border-color: rgba(255,215,0,0.4); background: rgba(255,215,0,0.08); }
</style>
