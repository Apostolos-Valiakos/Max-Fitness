<template>
  <div class="view">
    <ViewHeader title="HISTORY">
      <template #right>
        <div class="header-meta">{{ history.sessions.length }} sessions</div>
        <button class="view-toggle" @click="calendarMode = !calendarMode" :title="calendarMode ? 'List view' : 'Calendar view'">
          <i :class="calendarMode ? 'pi pi-list' : 'pi pi-calendar'" />
        </button>
      </template>
    </ViewHeader>

    <div v-if="history.sessions.length === 0" class="empty-state">
      <i class="pi pi-calendar empty-icon" />
      <p>No sessions logged yet.</p>
      <button class="cta-btn" @click="router.push('/workout/start')">Start a workout</button>
    </div>

    <!-- Calendar view -->
    <div v-else-if="calendarMode" class="calendar-wrap">
      <div class="cal-nav">
        <button class="cal-nav-btn" @click="prevMonth"><i class="pi pi-chevron-left" /></button>
        <span class="cal-month">{{ calMonthLabel }}</span>
        <button class="cal-nav-btn" @click="nextMonth"><i class="pi pi-chevron-right" /></button>
      </div>

      <div class="cal-grid">
        <div class="cal-dow" v-for="d in ['Mo','Tu','We','Th','Fr','Sa','Su']" :key="d">{{ d }}</div>
        <!-- Leading blanks -->
        <div v-for="_ in leadingBlanks" :key="'b'+_" class="cal-cell empty" />
        <!-- Day cells -->
        <div
          v-for="day in daysInMonth" :key="day"
          class="cal-cell"
          :class="{
            today: isToday(day),
            'has-session': sessionsByDay[day],
            'multi': sessionsByDay[day]?.length > 1
          }"
          @click="sessionsByDay[day] && router.push('/history/'+sessionsByDay[day][0].id)"
        >
          <span class="cal-day-num">{{ day }}</span>
          <span v-if="sessionsByDay[day]" class="cal-dot" />
        </div>
      </div>

      <!-- Sessions for selected view — show this month's sessions below calendar -->
      <div class="cal-sessions">
        <div v-for="s in thisMonthSessions" :key="s.id" class="cal-sess-row" @click="router.push('/history/'+s.id)">
          <div class="cal-sess-date">{{ formatDay(s.started_at) }}</div>
          <div class="cal-sess-name">{{ s.name }}</div>
          <div class="cal-sess-meta">{{ s.exerciseNames?.length ?? 0 }} exercises</div>
        </div>
      </div>
    </div>

    <!-- List view -->
    <div v-else>
      <div v-for="(group, week) in grouped" :key="week" class="week-group">
        <div class="week-label">{{ week }}</div>
        <SessionCard
          v-for="s in group" :key="s.id"
          :session="s"
          :exerciseNames="s.exerciseNames"
          :totalVolume="s.totalVolume"
          @click="router.push('/history/'+s.id)"
        />
      </div>

      <div class="load-more-wrap">
        <button
          v-if="history.canLoadMore"
          class="load-more-btn"
          :disabled="history.isLoading"
          @click="history.loadMore()"
        >
          <i v-if="history.isLoading" class="pi pi-spin pi-spinner" />
          <span v-else>Load older sessions</span>
        </button>
        <div v-else class="all-loaded">All sessions loaded</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ViewHeader from '@/components/ViewHeader.vue'
import { useHistoryStore } from '@/stores/historyStore'
import { useAuthStore }    from '@/stores/authStore'
import { getDatabase }     from '@/lib/rxdb/database'
import { format, startOfWeek, isThisWeek, differenceInCalendarWeeks, isToday as fnsIsToday, getDaysInMonth, startOfMonth } from 'date-fns'
import SessionCard from '@/components/SessionCard.vue'

const router  = useRouter()
const history = useHistoryStore()
const auth    = useAuthStore()
const enriched    = ref<any[]>([])
const calendarMode = ref(false)

// Calendar state
const calYear  = ref(new Date().getFullYear())
const calMonth = ref(new Date().getMonth()) // 0-indexed

const calMonthLabel = computed(() => format(new Date(calYear.value, calMonth.value, 1), 'MMMM yyyy'))

const daysInMonth = computed(() => getDaysInMonth(new Date(calYear.value, calMonth.value, 1)))

const leadingBlanks = computed(() => {
  const dow = startOfMonth(new Date(calYear.value, calMonth.value, 1)).getDay()
  // Mon=0 in display; JS Sunday=0 → shift: Mon=1,Tue=2,...Sun=7 → Mon=0
  return (dow + 6) % 7
})

function prevMonth() {
  if (calMonth.value === 0) { calYear.value--; calMonth.value = 11 }
  else calMonth.value--
}
function nextMonth() {
  if (calMonth.value === 11) { calYear.value++; calMonth.value = 0 }
  else calMonth.value++
}

function isToday(day: number) {
  return fnsIsToday(new Date(calYear.value, calMonth.value, day))
}

// Map day-of-month → sessions in that month
const sessionsByDay = computed<Record<number, any[]>>(() => {
  const map: Record<number, any[]> = {}
  for (const s of enriched.value) {
    const d = new Date(s.started_at)
    if (d.getFullYear() === calYear.value && d.getMonth() === calMonth.value) {
      const day = d.getDate()
      if (!map[day]) map[day] = []
      map[day].push(s)
    }
  }
  return map
})

const thisMonthSessions = computed(() =>
  enriched.value
    .filter(s => {
      const d = new Date(s.started_at)
      return d.getFullYear() === calYear.value && d.getMonth() === calMonth.value
    })
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
)

function formatDay(iso: string) {
  return format(new Date(iso), 'EEE d')
}

const grouped = computed(() => {
  const g: Record<string, any[]> = {}
  for (const s of enriched.value) {
    const d = new Date(s.started_at)
    const label = isThisWeek(d) ? 'This Week'
      : differenceInCalendarWeeks(new Date(), d) === 1 ? 'Last Week'
      : format(startOfWeek(d), 'MMM d, yyyy')
    if (!g[label]) g[label] = []
    g[label].push(s)
  }
  return g
})

async function enrich() {
  const db = getDatabase()
  const list = await Promise.all(
    history.sessions.map(async s => {
      const sets  = await db.sets.find({ selector: { session_id: { $eq: s.id } } }).exec()
      const sd    = sets.map(x => x.toJSON())
      const eIds  = [...new Set(sd.map(x => x.exercise_id))]
      const ed    = await db.exercises.find({ selector: { id: { $in: eIds } } }).exec()
      const nm    = Object.fromEntries(ed.map(e => [e.id, e.name]))
      return { ...s, exerciseNames: eIds.map(id => nm[id] ?? 'Unknown'), totalVolume: sd.reduce((a, x) => a + ((x.weight_kg ?? 0) * (x.reps ?? 0)), 0) }
    })
  )
  enriched.value = list
}

onMounted(() => {
  if (auth.user?.id) history.subscribeToSessions(auth.user.id)
  history.$subscribe(enrich)
  enrich()
})
</script>

<style scoped>
.view { padding: 1.5rem 1rem 0; color: #F0F0F0; font-family: 'DM Sans',sans-serif; background: #1C1C1E; min-height: 100vh; }
.header-meta { font-size: 0.72rem; color: #636366; }
.view-toggle { background: none; border: 1px solid #3A3A3C; color: #636366; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.85rem; transition: all 0.15s; }
.view-toggle:active { border-color: #4A9EFF; color: #4A9EFF; }

/* Calendar */
.calendar-wrap { padding-bottom: 2rem; }
.cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.cal-nav-btn { background: none; border: none; color: #636366; cursor: pointer; font-size: 0.9rem; padding: 0.25rem 0.5rem; }
.cal-nav-btn:active { color: #4A9EFF; }
.cal-month { font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 800; color: #F0F0F0; letter-spacing: 0.05em; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 1.25rem; }
.cal-dow { font-family: 'Barlow Condensed',sans-serif; font-size: 0.6rem; font-weight: 700; color: #8E8E93; text-align: center; padding: 0.25rem 0; letter-spacing: 0.1em; }
.cal-cell { min-height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; cursor: default; background: #1C1C1E; border: 1px solid #252528; position: relative; }
.cal-cell.empty { background: transparent; border-color: transparent; }
.cal-cell.today { border-color: #4A9EFF; }
.cal-cell.has-session { cursor: pointer; background: rgba(74,158,255,0.05); }
.cal-cell.has-session:active { background: rgba(74,158,255,0.15); }
.cal-day-num { font-family: 'Barlow Condensed',sans-serif; font-size: 0.8rem; font-weight: 700; color: #8E8E93; line-height: 1; }
.cal-cell.today .cal-day-num { color: #4A9EFF; }
.cal-cell.has-session .cal-day-num { color: #F0F0F0; }
.cal-dot { width: 5px; height: 5px; border-radius: 50%; background: #4A9EFF; }
.cal-sessions { display: flex; flex-direction: column; gap: 0.4rem; }
.cal-sess-row { display: flex; align-items: center; gap: 0.75rem; background: #1C1C1E; border: 1px solid #252528; padding: 0.75rem; cursor: pointer; transition: border-color 0.15s; }
.cal-sess-row:active { border-color: #4A9EFF; }
.cal-sess-date { font-family: 'Barlow Condensed',sans-serif; font-size: 0.8rem; font-weight: 700; color: #4A9EFF; width: 44px; flex-shrink: 0; }
.cal-sess-name { flex: 1; font-family: 'Barlow Condensed',sans-serif; font-size: 0.95rem; font-weight: 700; color: #F0F0F0; }
.cal-sess-meta { font-size: 0.7rem; color: #636366; }

/* List view */
.week-group { margin-bottom: 1.5rem; }
.week-label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.2em; color: #636366; margin-bottom: 0.5rem; padding-bottom: 0.4rem; border-bottom: 1px solid #252528; }
.empty-state { text-align: center; padding: 4rem 1rem; color: #8E8E93; }
.empty-icon { font-size: 3rem; color: #636366; display: block; margin-bottom: 1rem; }
.cta-btn { background: #4A9EFF; border: none; color: #fff; font-family: 'Barlow Condensed',sans-serif; font-weight: 700; letter-spacing: 0.1em; padding: 0.75rem 1.5rem; cursor: pointer; margin-top: 1rem; clip-path: polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%); }
.load-more-wrap { text-align: center; padding: 1.5rem; }
.load-more-btn { background: #1C1C1E; border: 1px solid #3A3A3C; color: #8E8E93; font-family: 'Barlow Condensed',sans-serif; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.65rem 1.5rem; cursor: pointer; transition: all 0.15s; }
.load-more-btn:active { border-color: #4A9EFF; color: #4A9EFF; }
.all-loaded { font-size: 0.72rem; color: #8E8E93; }
</style>
