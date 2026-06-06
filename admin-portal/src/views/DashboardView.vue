<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">DASHBOARD</h1>
      <div class="page-sub">{{ today }}</div>
    </div>

    <!-- KPI row -->
    <div class="kpi-grid">
      <div class="kpi-card" v-for="k in kpis" :key="k.label">
        <i :class="['pi', k.icon, 'kpi-icon']" />
        <div class="kpi-val">{{ k.value ?? '—' }}</div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend" :class="trendClass(k.delta)">
          <template v-if="k.delta === null">—</template>
          <template v-else-if="k.delta === 0">
            <i class="pi pi-minus" /> same as last {{ k.period }}
          </template>
          <template v-else>
            <i :class="k.delta > 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'" />
            {{ k.delta > 0 ? '+' : '' }}{{ k.delta }} vs last {{ k.period }}
          </template>
        </div>
      </div>
    </div>

    <!-- Bottom panels -->
    <div class="row-2">

      <!-- Panel 1: Needs Attention -->
      <div class="card panel">
        <div class="panel-title">NEEDS ATTENTION</div>

        <!-- Unanswered check-ins -->
        <div class="panel-section">
          <div class="subsection-header">
            <span class="subsection-label">UNANSWERED CHECK-INS</span>
            <span v-if="pendingCheckins.length" class="count-badge warn">{{ pendingCheckins.length }}</span>
            <span v-else class="count-badge ok"><i class="pi pi-check" /></span>
          </div>
          <div v-if="!pendingCheckins.length" class="all-clear">
            <i class="pi pi-check-circle" /> All check-ins answered
          </div>
          <div v-else class="item-list">
            <div v-for="ci in pendingCheckins" :key="ci.id" class="attention-row">
              <div class="ar-dot warn-dot" />
              <div class="ar-body">
                <span class="ar-name">{{ ci.clientName }}</span>
                <span class="ar-sep">→</span>
                <span class="ar-trainer">{{ ci.trainerName }}</span>
              </div>
              <span class="ar-age" :class="{ 'ar-age-old': ci.daysAgo >= 3 }">
                {{ ci.daysAgo === 0 ? 'today' : ci.daysAgo + 'd ago' }}
              </span>
            </div>
          </div>
        </div>

        <div class="section-divider" />

        <!-- Ultra without trainer -->
        <div class="panel-section">
          <div class="subsection-header">
            <span class="subsection-label">ULTRA WITHOUT TRAINER</span>
            <span v-if="ultraUnassigned.length" class="count-badge warn">{{ ultraUnassigned.length }}</span>
            <span v-else class="count-badge ok"><i class="pi pi-check" /></span>
          </div>
          <div v-if="!ultraUnassigned.length" class="all-clear">
            <i class="pi pi-check-circle" /> All ultra users assigned
          </div>
          <div v-else class="item-list">
            <div v-for="u in ultraUnassigned" :key="u.id" class="attention-row">
              <div class="ar-avatar">{{ initials(u.full_name ?? u.email) }}</div>
              <div class="ar-body">
                <span class="ar-name">{{ u.full_name ?? '—' }}</span>
                <span class="ar-sub">{{ u.email }}</span>
              </div>
              <router-link :to="`/users`" class="ar-cta">Assign</router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Panel 2: Overview -->
      <div class="card panel">
        <div class="panel-title">OVERVIEW</div>

        <!-- Tier distribution -->
        <div class="panel-section">
          <div class="subsection-header">
            <span class="subsection-label">TIER DISTRIBUTION</span>
            <span class="subsection-meta">{{ tierTotal }} total</span>
          </div>
          <div class="tier-list">
            <div v-for="t in tierDist" :key="t.tier" class="tier-row">
              <span class="tier-name">
                <span class="badge" :class="t.tier">{{ t.tier.toUpperCase() }}</span>
              </span>
              <div class="tier-bar-track">
                <div
                  class="tier-bar-fill"
                  :style="{ width: tierPct(t.count) + '%', background: t.color }"
                />
              </div>
              <span class="tier-count">{{ t.count }}</span>
              <span class="tier-pct">{{ tierPct(t.count) }}%</span>
            </div>
          </div>
        </div>

        <div class="section-divider" />

        <!-- Trainer workload -->
        <div class="panel-section">
          <div class="subsection-header">
            <span class="subsection-label">TRAINER WORKLOAD</span>
            <span class="subsection-meta">{{ trainerWorkload.length }} trainers</span>
          </div>
          <div v-if="!trainerWorkload.length" class="all-clear">
            <i class="pi pi-info-circle" /> No trainers yet
          </div>
          <div v-else class="item-list">
            <div v-for="t in trainerWorkload" :key="t.id" class="workload-row">
              <div class="wr-avatar">{{ initials(t.full_name ?? t.email) }}</div>
              <div class="wr-body">
                <div class="wr-name">{{ t.full_name ?? t.email }}</div>
                <div class="wr-bar-row">
                  <div class="wr-bar-track">
                    <div
                      class="wr-bar-fill"
                      :style="{ width: workloadPct(t.clientCount) + '%', background: workloadColor(t.clientCount) }"
                    />
                  </div>
                  <span class="wr-count" :style="{ color: workloadColor(t.clientCount) }">
                    {{ t.clientCount }} client{{ t.clientCount !== 1 ? 's' : '' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { listAuthUsers } from '@/lib/adminSupabase'
import { initials } from '@/lib/utils'
import {
  format, differenceInDays,
  startOfDay, startOfWeek, startOfMonth,
  subWeeks, subMonths,
} from 'date-fns'

const today = format(new Date(), 'EEEE, MMMM d yyyy')

// ── KPI state ──────────────────────────────────────────────────────────────
const totalUsers          = ref<number | null>(null)
const sessionsToday       = ref<number | null>(null)
const sessionsWeek        = ref<number | null>(null)
const newThisMonth        = ref<number | null>(null)
const sessionsTodayDelta  = ref<number | null>(null)
const sessionsWeekDelta   = ref<number | null>(null)
const newMonthDelta       = ref<number | null>(null)

// ── Panel state ────────────────────────────────────────────────────────────
const pendingCheckins = ref<{
  id: string; clientName: string; trainerName: string; daysAgo: number
}[]>([])

const ultraUnassigned = ref<{
  id: string; full_name: string | null; email: string
}[]>([])

const tierDist = ref<{ tier: string; count: number; color: string }[]>([])

const trainerWorkload = ref<{
  id: string; full_name: string | null; email: string; clientCount: number
}[]>([])

// ── Computed ───────────────────────────────────────────────────────────────
const tierTotal = computed(() => tierDist.value.reduce((s, t) => s + t.count, 0))

const kpis = computed(() => [
  {
    label: 'Total Users',
    value: totalUsers.value,
    icon:  'pi-users',
    delta: newMonthDelta.value,
    period: 'month',
  },
  {
    label: 'Sessions Today',
    value: sessionsToday.value,
    icon:  'pi-calendar',
    delta: sessionsTodayDelta.value,
    period: 'Mon',
  },
  {
    label: 'Sessions This Week',
    value: sessionsWeek.value,
    icon:  'pi-chart-bar',
    delta: sessionsWeekDelta.value,
    period: 'week',
  },
  {
    label: 'New This Month',
    value: newThisMonth.value,
    icon:  'pi-user-plus',
    delta: newMonthDelta.value,
    period: 'month',
  },
])

function trendClass(delta: number | null) {
  if (delta === null || delta === 0) return 'trend-neutral'
  return delta > 0 ? 'trend-up' : 'trend-down'
}

function tierPct(count: number) {
  return tierTotal.value > 0 ? Math.round((count / tierTotal.value) * 100) : 0
}

const OVERLOAD_THRESHOLD = 10
function workloadPct(n: number) {
  return Math.min(100, Math.round((n / OVERLOAD_THRESHOLD) * 100))
}
function workloadColor(n: number) {
  if (n === 0)  return '#636366'
  if (n <= 4)   return '#34C759'
  if (n <= 7)   return '#FFB400'
  return '#FF6B6B'
}

// ── Data loading ───────────────────────────────────────────────────────────
onMounted(async () => {
  const now            = new Date()
  const todayStart     = startOfDay(now).toISOString()
  const weekStart      = startOfWeek(now, { weekStartsOn: 1 }).toISOString()
  const monthStart     = startOfMonth(now).toISOString()
  const lastWeekToday  = startOfDay(subWeeks(now, 1)).toISOString()
  const lastWeekTodayEnd = startOfDay(now).toISOString()
  const lastWeekStart  = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }).toISOString()
  const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString()

  // Fire all DB queries in parallel
  const [
    { count: st },
    { count: sw },
    { count: stlw },
    { count: swlw },
    { data: profiles },
    { data: assignments },
    { data: pendingSubs },
  ] = await Promise.all([
    supabase.from('workout_sessions').select('*', { count: 'exact', head: true })
      .gte('started_at', todayStart).not('finished_at', 'is', null),
    supabase.from('workout_sessions').select('*', { count: 'exact', head: true })
      .gte('started_at', weekStart).not('finished_at', 'is', null),
    supabase.from('workout_sessions').select('*', { count: 'exact', head: true })
      .gte('started_at', lastWeekToday).lt('started_at', lastWeekTodayEnd)
      .not('finished_at', 'is', null),
    supabase.from('workout_sessions').select('*', { count: 'exact', head: true })
      .gte('started_at', lastWeekStart).lt('started_at', weekStart)
      .not('finished_at', 'is', null),
    supabase.from('profiles').select('*'),
    supabase.from('trainer_assignments').select('trainer_id, client_id').eq('is_active', true),
    supabase.from('checkin_submissions')
      .select('id, trainer_id, client_id, submitted_at')
      .is('trainer_reply', null)
      .order('submitted_at', { ascending: false })
      .limit(10),
  ])

  sessionsToday.value      = st ?? 0
  sessionsWeek.value       = sw ?? 0
  sessionsTodayDelta.value = (st ?? 0) - (stlw ?? 0)
  sessionsWeekDelta.value  = (sw ?? 0) - (swlw ?? 0)

  try {
    const authUsers = await listAuthUsers()
    totalUsers.value   = authUsers.length
    newThisMonth.value = authUsers.filter(u => u.created_at >= monthStart).length
    const newLastMonth = authUsers.filter(u => u.created_at >= lastMonthStart && u.created_at < monthStart).length
    newMonthDelta.value = (newThisMonth.value ?? 0) - newLastMonth

    const emailMap       = Object.fromEntries(authUsers.map(u => [u.id, u.email ?? '']))
    const assignedSet    = new Set((assignments ?? []).map(a => a.client_id))
    const profileMap     = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    // Tier distribution
    const counts = { free: 0, paid: 0, ultra: 0 }
    for (const p of profiles ?? []) {
      if (p.tier in counts) counts[p.tier as keyof typeof counts]++
    }
    tierDist.value = [
      { tier: 'free',  count: counts.free,  color: '#636366' },
      { tier: 'paid',  count: counts.paid,  color: '#4A9EFF' },
      { tier: 'ultra', count: counts.ultra, color: '#FFB400' },
    ]

    // Trainer workload
    const clientCounts: Record<string, number> = {}
    for (const a of assignments ?? []) {
      clientCounts[a.trainer_id] = (clientCounts[a.trainer_id] ?? 0) + 1
    }
    trainerWorkload.value = (profiles ?? [])
      .filter(p => p.role === 'trainer' || p.role === 'admin')
      .map(p => ({
        id:          p.id,
        full_name:   p.full_name,
        email:       emailMap[p.id] ?? '',
        clientCount: clientCounts[p.id] ?? 0,
      }))
      .sort((a, b) => b.clientCount - a.clientCount)

    // Ultra without trainer
    ultraUnassigned.value = (profiles ?? [])
      .filter(p => p.tier === 'ultra' && !assignedSet.has(p.id))
      .map(p => ({ id: p.id, full_name: p.full_name, email: emailMap[p.id] ?? '' }))
      .slice(0, 8)

    // Pending check-ins with resolved names
    pendingCheckins.value = (pendingSubs ?? []).map(s => ({
      id:          s.id,
      clientName:  profileMap[s.client_id]?.full_name  ?? emailMap[s.client_id]  ?? '?',
      trainerName: profileMap[s.trainer_id]?.full_name ?? emailMap[s.trainer_id] ?? '?',
      daysAgo:     differenceInDays(now, new Date(s.submitted_at)),
    }))

  } catch (e) {
    console.error('[dashboard]', e)
  }
})
</script>

<style scoped>
.page        { padding: 2.5rem; }
.page-header { margin-bottom: 2rem; }
.page-title  { line-height: 1; }
.page-sub    { margin-top: 0.3rem; }

/* ── KPI cards ──────────────────────────────────────────────────────────── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.75rem;
}
.kpi-card {
  background: #1C1C1E;
  border: 1px solid #252528;
  padding: 1.5rem 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  border-top: 2px solid #252528;
  transition: border-top-color 0.2s;
}
.kpi-card:hover { border-top-color: #4A9EFF; }

.kpi-icon  { font-size: 1rem; color: #4A9EFF; margin-bottom: 0.25rem; }
.kpi-val   { font-family: 'Barlow Condensed', sans-serif; font-size: 2.75rem; font-weight: 900; color: #F0F0F0; line-height: 1; }
.kpi-label { font-size: 0.68rem; color: #636366; text-transform: uppercase; letter-spacing: 0.12em; }

.kpi-trend {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  margin-top: 0.35rem;
  padding-top: 0.5rem;
  border-top: 1px solid #252528;
}
.kpi-trend .pi { font-size: 0.6rem; }
.trend-up      { color: #34C759; }
.trend-down    { color: #FF6B6B; }
.trend-neutral { color: #636366; }

/* ── Bottom row ─────────────────────────────────────────────────────────── */
.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

.panel {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.panel-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  color: #4A9EFF;
  margin-bottom: 1.25rem;
}

/* Panel sections */
.panel-section { padding: 0; }

.section-divider {
  height: 1px;
  background: #252528;
  margin: 1.25rem 0;
}

.subsection-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
}
.subsection-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #636366;
  flex: 1;
}
.subsection-meta {
  font-size: 0.7rem;
  color: #636366;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.62rem;
  font-weight: 800;
  min-width: 18px;
  height: 18px;
  padding: 0 0.3rem;
  border-radius: 9px;
}
.count-badge.warn { background: rgba(255,180,0,0.15); color: #FFB400; border: 1px solid rgba(255,180,0,0.3); }
.count-badge.ok   { background: rgba(52,199,89,0.1);  color: #34C759; border: 1px solid rgba(52,199,89,0.2); font-size: 0.55rem; }

.all-clear {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: #34C759;
  padding: 0.6rem 0;
}
.all-clear .pi { font-size: 0.85rem; }

/* Attention rows */
.item-list { display: flex; flex-direction: column; gap: 0.5rem; }

.attention-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.65rem;
  background: #252528;
  border: 1px solid #2C2C2E;
  border-left: 2px solid #FFB400;
}

.ar-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.warn-dot { background: #FFB400; }

.ar-avatar {
  width: 26px;
  height: 26px;
  background: #3A3A3C;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.62rem;
  font-weight: 800;
  color: #8E8E93;
  flex-shrink: 0;
  border-radius: 50%;
}

.ar-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.ar-name    { font-size: 0.82rem; color: #C7C7CC; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ar-sep     { color: #636366; font-size: 0.7rem; }
.ar-trainer { font-size: 0.72rem; color: #636366; }
.ar-sub     { font-size: 0.7rem; color: #636366; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.ar-age       { font-size: 0.68rem; color: #636366; flex-shrink: 0; }
.ar-age-old   { color: #FF6B6B; }

.ar-cta {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #4A9EFF;
  text-decoration: none;
  flex-shrink: 0;
  transition: opacity 0.15s;
}
.ar-cta:hover { opacity: 0.75; }

/* ── Tier bars ──────────────────────────────────────────────────────────── */
.tier-list { display: flex; flex-direction: column; gap: 0.65rem; }
.tier-row  { display: flex; align-items: center; gap: 0.75rem; }
.tier-name { width: 52px; flex-shrink: 0; }

.tier-bar-track {
  flex: 1;
  height: 6px;
  background: #252528;
  border-radius: 3px;
  overflow: hidden;
}
.tier-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s ease;
  min-width: 2px;
}

.tier-count { font-size: 0.78rem; color: #C7C7CC; font-weight: 500; width: 22px; text-align: right; flex-shrink: 0; }
.tier-pct   { font-size: 0.68rem; color: #636366; width: 32px; text-align: right; flex-shrink: 0; }

/* ── Trainer workload ───────────────────────────────────────────────────── */
.workload-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid #252528;
}
.workload-row:last-child { border-bottom: none; }

.wr-avatar {
  width: 28px;
  height: 28px;
  background: rgba(0,136,255,0.1);
  border: 1px solid rgba(0,136,255,0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.65rem;
  font-weight: 800;
  color: #0088FF;
  flex-shrink: 0;
}

.wr-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.wr-name { font-size: 0.82rem; color: #C7C7CC; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.wr-bar-row   { display: flex; align-items: center; gap: 0.5rem; }
.wr-bar-track { flex: 1; height: 4px; background: #252528; border-radius: 2px; overflow: hidden; }
.wr-bar-fill  { height: 100%; border-radius: 2px; transition: width 0.6s ease; min-width: 2px; }
.wr-count     { font-size: 0.68rem; font-weight: 600; flex-shrink: 0; width: 54px; text-align: right; }
</style>
