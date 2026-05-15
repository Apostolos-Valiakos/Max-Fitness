<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">DASHBOARD</h1>
      <div class="page-sub">{{ today }}</div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card" v-for="k in kpis" :key="k.label">
        <div class="kpi-icon"><i :class="k.icon" /></div>
        <div class="kpi-val">{{ k.value ?? '—' }}</div>
        <div class="kpi-label">{{ k.label }}</div>
      </div>
    </div>

    <div class="row-2">
      <!-- Recent sign-ups -->
      <div class="card panel">
        <div class="section-title">RECENT SIGN-UPS</div>
        <table class="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Tier</th><th>Joined</th></tr></thead>
          <tbody>
            <tr v-for="u in recentUsers" :key="u.id">
              <td class="td-name">{{ u.full_name ?? '—' }}</td>
              <td>{{ u.email }}</td>
              <td><span class="badge" :class="u.tier">{{ u.tier.toUpperCase() }}</span></td>
              <td class="td-date">{{ fmtDate(u.created_at) }}</td>
            </tr>
            <tr v-if="recentUsers.length === 0"><td colspan="4" class="td-empty">No data</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Recent sessions -->
      <div class="card panel">
        <div class="section-title">RECENT ACTIVITY FEED</div>
        <table class="data-table">
          <thead><tr><th>User</th><th>Workout</th><th>Duration</th><th>When</th><th></th></tr></thead>
          <tbody>
            <tr v-for="s in recentSessions" :key="s.id">
              <td class="td-muted">{{ userNames[s.user_id] ?? s.user_id.slice(0, 8) }}</td>
              <td class="td-name">{{ s.name }}</td>
              <td class="td-date">{{ fmtDuration(s.started_at, s.finished_at) }}</td>
              <td class="td-date">{{ fmtDate(s.started_at) }}</td>
              <td>
                <router-link :to="`/clients/${s.user_id}`" class="feed-link" title="View client">
                  <i class="pi pi-arrow-right" />
                </router-link>
              </td>
            </tr>
            <tr v-if="recentSessions.length === 0"><td colspan="5" class="td-empty">No data</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { listAuthUsers } from '@/lib/adminSupabase'
import { format, startOfDay, startOfWeek, startOfMonth } from 'date-fns'
import type { UserRow, WorkoutSession } from '@/lib/database.types'

const today = format(new Date(), 'EEEE, MMMM d yyyy')

const totalUsers    = ref<number | null>(null)
const sessionsToday = ref<number | null>(null)
const sessionsWeek  = ref<number | null>(null)
const newThisMonth  = ref<number | null>(null)
const recentUsers   = ref<UserRow[]>([])
const recentSessions = ref<WorkoutSession[]>([])
const userNames     = ref<Record<string, string>>({})

const kpis = computed(() => [
  { label: 'Total Users',       value: totalUsers.value,    icon: 'pi pi-users'      },
  { label: 'Sessions Today',    value: sessionsToday.value, icon: 'pi pi-calendar'   },
  { label: 'Sessions This Week',value: sessionsWeek.value,  icon: 'pi pi-chart-bar'  },
  { label: 'New This Month',    value: newThisMonth.value,  icon: 'pi pi-user-plus'  },
])

function fmtDate(iso: string) { return format(new Date(iso), 'MMM d') }
function fmtDuration(start: string, end: string | null) {
  if (!end) return 'In progress'
  const secs = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  const m = Math.floor(secs / 60); const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

onMounted(async () => {
  const now   = new Date()
  const todayStart = startOfDay(now).toISOString()
  const weekStart  = startOfWeek(now).toISOString()
  const monthStart = startOfMonth(now).toISOString()

  // Total users
  const { count: uc } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  totalUsers.value = uc ?? 0

  // Sessions today
  const { count: st } = await supabase.from('workout_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('started_at', todayStart).not('finished_at', 'is', null)
  sessionsToday.value = st ?? 0

  // Sessions this week
  const { count: sw } = await supabase.from('workout_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('started_at', weekStart).not('finished_at', 'is', null)
  sessionsWeek.value = sw ?? 0

  // New this month — from auth.users
  try {
    const authUsers = await listAuthUsers()
    newThisMonth.value = authUsers.filter(u => u.created_at >= monthStart).length
    totalUsers.value   = authUsers.length

    // Recent sign-ups: join with profiles
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(8)
    const emailMap = Object.fromEntries(authUsers.map(u => [u.id, u.email]))
    recentUsers.value = (profiles ?? []).map(p => ({ ...p, email: emailMap[p.id] ?? '' }))
  } catch {}

  // Recent sessions
  const { data: sessions } = await supabase.from('workout_sessions')
    .select('*').not('finished_at', 'is', null).order('started_at', { ascending: false }).limit(12)
  recentSessions.value = (sessions ?? []) as WorkoutSession[]

  // Load user names for activity feed
  const uids = [...new Set((sessions ?? []).map(s => s.user_id))]
  if (uids.length) {
    const { data: uProfiles } = await supabase.from('profiles').select('id, full_name').in('id', uids)
    for (const p of uProfiles ?? []) userNames.value[p.id] = p.full_name ?? p.id.slice(0, 8)
  }
})
</script>

<style scoped>
.page { padding: 2rem; }
.page-header { margin-bottom: 2rem; }
.page-title { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: #F0F0F0; letter-spacing: 0.05em; line-height: 1; }
.page-sub   { font-size: 0.75rem; color: #444; margin-top: 0.25rem; }

.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
.kpi-card { background: #111; border: 1px solid #1A1A1A; padding: 1.5rem 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
.kpi-icon { font-size: 1.1rem; color: #FF4D00; }
.kpi-val  { font-family: 'Barlow Condensed', sans-serif; font-size: 2.5rem; font-weight: 900; color: #F0F0F0; line-height: 1; }
.kpi-label{ font-size: 0.7rem; color: #555; text-transform: uppercase; letter-spacing: 0.1em; }

.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.panel { padding: 1.25rem; }

.td-name  { color: #C0C0C0; font-weight: 500; }
.td-muted { color: #555; font-size: 0.78rem; }
.td-date  { color: #444; font-size: 0.78rem; }
.td-empty { color: #333; font-size: 0.8rem; text-align: center; padding: 1.5rem; }
.feed-link { color: #444; font-size: 0.72rem; text-decoration: none; transition: color 0.15s; }
.feed-link:hover { color: #FF4D00; }
</style>
