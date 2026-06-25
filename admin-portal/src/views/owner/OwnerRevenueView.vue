<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">REVENUE</h1>
    </div>

    <div v-if="loading" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading…</div>

    <template v-else>
      <!-- KPIs -->
      <div class="kpi-row">
        <div class="kpi-card card">
          <div class="kpi-val green">€{{ totalMRR.toLocaleString() }}</div>
          <div class="kpi-label">Est. MRR</div>
        </div>
        <div class="kpi-card card">
          <div class="kpi-val green">€{{ (totalMRR * 12).toLocaleString() }}</div>
          <div class="kpi-label">Est. ARR</div>
        </div>
        <div class="kpi-card card">
          <div class="kpi-val">{{ activeGyms }}</div>
          <div class="kpi-label">Active Gyms</div>
        </div>
        <div class="kpi-card card">
          <div class="kpi-val orange">{{ suspendedGyms }}</div>
          <div class="kpi-label">Suspended / Churned</div>
        </div>
      </div>

      <!-- Charts row -->
      <div class="charts-row">
        <div class="card chart-panel">
          <div class="section-title">MRR BY GYM</div>
          <div class="chart-wrap">
            <Bar :data="mrrChart" :options="barOpts" />
          </div>
        </div>
        <div class="card chart-panel">
          <div class="section-title">GYMS BY PLAN</div>
          <div class="chart-wrap">
            <Bar :data="planChart" :options="barOpts" />
          </div>
        </div>
      </div>

      <!-- Per-gym breakdown table -->
      <div class="card table-panel">
        <div class="section-title">PER-GYM BREAKDOWN</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Gym</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Users</th>
              <th>Trainers</th>
              <th>Clients</th>
              <th>Est. MRR</th>
              <th>Est. ARR</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in gymRows" :key="row.id">
              <td class="td-name">{{ row.name }}</td>
              <td><span class="plan-badge" :class="row.plan">{{ row.plan.toUpperCase() }}</span></td>
              <td>
                <span class="status-dot" :class="row.subscription_status" />
                <span class="td-muted">{{ row.subscription_status }}</span>
              </td>
              <td class="td-val">{{ row.total }}</td>
              <td class="td-muted">{{ row.trainers }}</td>
              <td class="td-muted">{{ row.clients }}</td>
              <td class="td-val green">€{{ row.mrr.toLocaleString() }}</td>
              <td class="td-val green">€{{ (row.mrr * 12).toLocaleString() }}</td>
            </tr>
            <tr v-if="!gymRows.length">
              <td colspan="8" class="td-empty">No gyms yet</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Plan summary -->
      <div class="card table-panel">
        <div class="section-title">PLAN SUMMARY</div>
        <table class="data-table">
          <thead><tr><th>Plan</th><th>Gyms</th><th>Price / mo</th><th>Total MRR</th><th>% of MRR</th></tr></thead>
          <tbody>
            <tr v-for="ps in planSummary" :key="ps.plan">
              <td><span class="plan-badge" :class="ps.plan">{{ ps.plan.toUpperCase() }}</span></td>
              <td class="td-val">{{ ps.count }}</td>
              <td class="td-muted">€{{ ps.price }}</td>
              <td class="td-val green">€{{ (ps.count * ps.price).toLocaleString() }}</td>
              <td class="td-muted">{{ totalMRR ? Math.round(ps.count * ps.price / totalMRR * 100) : 0 }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
import { adminSupabase } from '@/lib/adminSupabase'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const PLAN_MRR: Record<string, number> = { basic: 49, pro: 149, elite: 299 }
const PLAN_COLOR: Record<string, string> = {
  basic: '#636366',
  pro:   '#4A9EFF',
  elite: '#FFB400',
}

const tickStyle = { color: '#636366', font: { size: 9 } }
const gridStyle = { color: '#252528' }
const barOpts   = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { x: { ticks: tickStyle, grid: gridStyle }, y: { ticks: tickStyle, grid: gridStyle } },
}

// ── State ────────────────────────────────────────────────────────────────────
const loading = ref(true)
const gyms    = ref<any[]>([])
const counts  = ref<Record<string, { total: number; trainers: number; clients: number }>>({})

// ── Derived ───────────────────────────────────────────────────────────────────
const gymRows = computed(() =>
  gyms.value.map(g => ({
    ...g,
    mrr:      PLAN_MRR[g.plan] ?? 0,
    total:    counts.value[g.id]?.total    ?? 0,
    trainers: counts.value[g.id]?.trainers ?? 0,
    clients:  counts.value[g.id]?.clients  ?? 0,
  })).sort((a, b) => b.mrr - a.mrr)
)

const totalMRR = computed(() => gymRows.value.filter(r => r.subscription_status !== 'suspended' && r.subscription_status !== 'canceled').reduce((a, r) => a + r.mrr, 0))
const activeGyms    = computed(() => gyms.value.filter(g => g.subscription_status === 'active' || g.subscription_status === 'trialing').length)
const suspendedGyms = computed(() => gyms.value.filter(g => g.subscription_status === 'suspended' || g.subscription_status === 'canceled').length)

const planSummary = computed(() =>
  ['elite', 'pro', 'basic'].map(plan => ({
    plan,
    count: gyms.value.filter(g => g.plan === plan).length,
    price: PLAN_MRR[plan],
  }))
)

const mrrChart = computed(() => {
  const rows = gymRows.value.slice(0, 12)
  return {
    labels: rows.map(r => r.name),
    datasets: [{
      data: rows.map(r => r.mrr),
      backgroundColor: rows.map(r => PLAN_COLOR[r.plan] + 'aa'),
      borderColor:     rows.map(r => PLAN_COLOR[r.plan]),
      borderWidth: 1, borderRadius: 3,
    }],
  }
})

const planChart = computed(() => {
  const plans = ['basic', 'pro', 'elite']
  return {
    labels: plans.map(p => p.toUpperCase()),
    datasets: [{
      data: plans.map(p => gyms.value.filter(g => g.plan === p).length),
      backgroundColor: plans.map(p => PLAN_COLOR[p] + 'aa'),
      borderColor:     plans.map(p => PLAN_COLOR[p]),
      borderWidth: 1, borderRadius: 3,
    }],
  }
})

// ── Load ─────────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  const [gymsRes, profilesRes] = await Promise.all([
    adminSupabase.from('gyms').select('*').order('created_at', { ascending: false }),
    adminSupabase.from('profiles').select('gym_id, role').not('gym_id', 'is', null),
  ])

  gyms.value = gymsRes.data ?? []

  const map: Record<string, { total: number; trainers: number; clients: number }> = {}
  for (const p of profilesRes.data ?? []) {
    const gid = p.gym_id
    if (!map[gid]) map[gid] = { total: 0, trainers: 0, clients: 0 }
    map[gid].total++
    if (p.role === 'trainer') map[gid].trainers++
    else if (p.role === 'user') map[gid].clients++
  }
  counts.value = map
  loading.value = false
}

onMounted(load)
</script>

<style scoped>
.kpi-row  { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.kpi-card { padding: 1.25rem; }
.kpi-val  { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: var(--text); line-height: 1; }
.kpi-label{ font-size: 0.67rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.35rem; }

.charts-row  { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
.chart-panel { padding: 1.25rem; }
.chart-wrap  { height: 200px; margin-top: 0.75rem; }
.table-panel { padding: 1.25rem; margin-bottom: 1rem; }

.data-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 0.75rem; }
.data-table th { font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; color: var(--muted); padding: 0 0.5rem 0.6rem; text-align: left; border-bottom: 1px solid var(--surface); }
.data-table td { padding: 0.55rem 0.5rem; border-bottom: 1px solid var(--bg); vertical-align: middle; }

.td-name  { color: #C7C7CC; font-weight: 500; }
.td-muted { color: var(--muted); font-size: 0.78rem; }
.td-val   { color: #AEAEB2; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
.td-empty { color: var(--border); font-size: 0.8rem; text-align: center; padding: 1.5rem; }
.green  { color: #34C759; }
.orange { color: var(--gold); }

.plan-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.15em; padding: 0.15rem 0.5rem; display: inline-block; }
.plan-badge.basic { background: var(--surface); color: var(--muted); }
.plan-badge.pro   { background: rgba(74,158,255,0.1); color: var(--accent); border: 1px solid rgba(74,158,255,0.3); }
.plan-badge.elite { background: rgba(255,180,0,0.1); color: var(--gold); border: 1px solid rgba(255,180,0,0.3); }

.status-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 0.45rem; }
.status-dot.active    { background: #34C759; }
.status-dot.trialing  { background: var(--accent); }
.status-dot.past_due  { background: var(--gold); }
.status-dot.suspended,
.status-dot.canceled  { background: var(--danger); }
</style>
