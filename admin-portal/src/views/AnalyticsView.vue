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
      <div v-if="tabLoaded.overview && activeTab === 'overview'">
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
      <div v-if="tabLoaded.growth && activeTab === 'growth'">
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

      <!-- ── ENGAGEMENT ──────────────────────────────────────────────────── -->
      <div v-if="tabLoaded.engagement && activeTab === 'engagement'">
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
      <div v-if="tabLoaded.trainers && activeTab === 'trainers'">
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
      <div v-if="tabLoaded.content && activeTab === 'content'">
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
import { callAdminFunction } from '@/lib/adminApi'
import { useGymFilter } from '@/composables/useGymFilter'
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

// ── Tabs ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',   label: 'OVERVIEW'   },
  { id: 'growth',     label: 'GROWTH'     },
  { id: 'engagement', label: 'ENGAGEMENT' },
  { id: 'trainers',   label: 'TRAINERS'   },
  { id: 'content',    label: 'CONTENT'    },
]

const activeTab  = ref('overview')
const tabLoading = ref(false)
const tabLoaded  = reactive({ overview: false, growth: false, engagement: false, trainers: false, content: false })

const { activeGymId } = useGymFilter()

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

async function loadTab(tab: string) {
  return callAdminFunction<Record<string, any>>('admin-analytics', { tab, gym_id: activeGymId.value })
}

// ── Load: OVERVIEW ───────────────────────────────────────────────────────────
async function loadOverview() {
  Object.assign(ov, await loadTab('overview'))
  tabLoaded.overview = true
}

async function loadGrowth() {
  Object.assign(gr, await loadTab('growth'))
  tabLoaded.growth = true
}

async function loadEngagement() {
  Object.assign(eg, await loadTab('engagement'))
  tabLoaded.engagement = true
}

async function loadTrainers() {
  Object.assign(tr, await loadTab('trainers'))
  tabLoaded.trainers = true
}

async function loadContent() {
  Object.assign(ct, await loadTab('content'))
  tabLoaded.content = true
}

// ── Tab switching ─────────────────────────────────────────────────────────────
async function switchTab(id: string) {
  activeTab.value = id
  if (tabLoaded[id as keyof typeof tabLoaded]) return
  tabLoading.value = true
  try {
    if (id === 'growth')     await loadGrowth()
    if (id === 'engagement') await loadEngagement()
    if (id === 'trainers')   await loadTrainers()
    if (id === 'content')    await loadContent()
  } catch (err) {
    console.error(`[Analytics] load${id} error:`, err)
    ;(tabLoaded as any)[id] = true
  } finally {
    tabLoading.value = false
  }
}

onMounted(async () => {
  tabLoading.value = true
  try {
    await loadOverview()
  } catch (err) {
    console.error('[Analytics] loadOverview error:', err)
    tabLoaded.overview = true
  } finally {
    tabLoading.value = false
  }
})
</script>

<style scoped>
/* Tab bar */
.tab-bar { display: flex; gap: 0; margin-bottom: 1.75rem; border-bottom: 1px solid var(--surface); }
.tab-btn {
  background: none; border: none; border-bottom: 2px solid transparent;
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.78rem; font-weight: 700;
  letter-spacing: 0.15em; color: var(--muted); padding: 0.6rem 1rem; cursor: pointer;
  transition: color 0.15s, border-color 0.15s; margin-bottom: -1px;
}
.tab-btn:hover  { color: #AEAEB2; }
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }

/* KPIs */
.kpi-row  { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.kpi-card { padding: 1.25rem; }
.kpi-val  { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: var(--text); line-height: 1; }
.kpi-unit { font-size: 1rem; margin-left: 0.2rem; }
.kpi-label{ font-size: 0.67rem; color: var(--muted); letter-spacing: 0.1em; margin-top: 0.35rem; }

/* Charts */
.charts-row  { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
.chart-panel { padding: 1.25rem; }
.chart-wrap  { height: 200px; margin-top: 0.75rem; }
.chart-tall  { height: 160px; }

/* Tables */
.table-panel { padding: 1.25rem; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 0.75rem; }
.data-table th { font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; color: var(--muted); padding: 0 0.5rem 0.6rem; text-align: left; border-bottom: 1px solid var(--surface); }
.data-table td { padding: 0.55rem 0.5rem; border-bottom: 1px solid var(--bg); vertical-align: middle; }

.section-title { font-family: 'Barlow Condensed', sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; color: var(--muted); }
.td-rank  { color: var(--muted); font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
.td-name  { color: #C7C7CC; font-weight: 500; }
.td-muted { color: var(--muted); font-size: 0.78rem; }
.td-val   { color: #AEAEB2; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
.td-empty { color: var(--border); font-size: 0.8rem; text-align: center; padding: 1.5rem; }

.orange { color: var(--accent); }
.green  { color: #34C759; }

.chip-tag { font-family: 'Barlow Condensed', sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; background: var(--surface); border: 1px solid var(--border); color: var(--sub); padding: 0.15rem 0.4rem; text-transform: uppercase; }

</style>
