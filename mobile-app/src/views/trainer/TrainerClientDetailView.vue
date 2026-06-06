<template>
  <div class="view">
    <div class="view-header">
      <button class="back-btn" @click="router.back()"><i class="pi pi-arrow-left" /></button>
      <div class="header-body">
        <h1 class="client-name">{{ client?.full_name ?? 'Client' }}</h1>
        <span class="tier-chip" :class="client?.tier">{{ client?.tier?.toUpperCase() }}</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button v-for="tab in TABS" :key="tab.id" class="tab" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
        {{ tab.label }}
      </button>
    </div>

    <!-- ── History tab ───────────────────────────────────────────────── -->
    <div v-if="activeTab === 'history'">
      <div v-if="loadingHistory" class="tab-loading"><i class="pi pi-spin pi-spinner" /></div>
      <div v-else-if="sessions.length === 0" class="tab-empty">No completed sessions yet.</div>
      <div v-else class="session-list">
        <div
          v-for="s in sessions"
          :key="s.id"
          class="session-row"
          @click="selectedSession = s; feedbackDraft = s.feedback ?? ''"
        >
          <div class="sess-left">
            <div class="sess-name">{{ s.name }}</div>
            <div class="sess-meta">{{ fmtDate(s.started_at) }} · {{ s.total_sets }} sets · {{ Math.round(s.total_volume).toLocaleString() }} kg</div>
          </div>
          <span v-if="s.feedback" class="feedback-dot" title="Feedback written"><i class="pi pi-comment" /></span>
        </div>
      </div>

      <!-- Session feedback panel -->
      <div v-if="selectedSession" class="feedback-panel">
        <div class="fp-header">
          <div class="fp-title">{{ selectedSession.name }} — <span class="fp-date">{{ fmtDate(selectedSession.started_at) }}</span></div>
          <button class="fp-close" @click="selectedSession = null"><i class="pi pi-times" /></button>
        </div>
        <div class="fp-stats">
          <span>{{ selectedSession.total_sets }} sets</span>
          <span>{{ Math.round(selectedSession.total_volume).toLocaleString() }} kg</span>
          <span v-if="selectedSession.duration_secs">{{ formatDuration(selectedSession.duration_secs) }}</span>
        </div>
        <textarea
          v-model="feedbackDraft"
          class="feedback-textarea"
          placeholder="Leave feedback for this session…"
          rows="4"
        />
        <div class="fp-actions">
          <button v-if="selectedSession.feedback_id" class="btn-del" @click="handleDeleteFeedback">Delete</button>
          <button class="btn-save" @click="handleSaveFeedback" :disabled="!feedbackDraft.trim()">
            {{ savingFeedback ? 'Saving…' : 'Save Feedback' }}
          </button>
        </div>
        <div v-if="feedbackError" class="fp-error">{{ feedbackError }}</div>
      </div>
    </div>

    <!-- ── Stats tab ─────────────────────────────────────────────────── -->
    <div v-if="activeTab === 'stats'" class="stats-content">
      <div v-if="loadingHistory" class="tab-loading"><i class="pi pi-spin pi-spinner" /></div>
      <div v-else>
        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-val">{{ sessions.length }}</div>
            <div class="kpi-lbl">Total Sessions</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val">{{ weeklyAvg }}</div>
            <div class="kpi-lbl">Avg / Week</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val">{{ totalVolume }}</div>
            <div class="kpi-lbl">Total Vol (kg)</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val">{{ compliance }}%</div>
            <div class="kpi-lbl">Plan Compliance</div>
          </div>
        </div>

        <div class="chart-section">
          <div class="section-label">SESSIONS — LAST 8 WEEKS</div>
          <div class="bar-chart">
            <div v-for="(bar, i) in weekBars" :key="i" class="bar-col">
              <div class="bar-fill" :style="{ height: bar.pct + '%' }" />
              <div class="bar-lbl">{{ bar.label }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Plans tab ─────────────────────────────────────────────────── -->
    <div v-if="activeTab === 'plans'" class="plans-content">
      <div class="plans-header">
        <div class="section-label">ACTIVE PLANS</div>
        <button class="assign-btn" @click="showAssignModal = true"><i class="pi pi-plus" /> ASSIGN PLAN</button>
      </div>

      <div v-if="loadingAssignments" class="tab-loading"><i class="pi pi-spin pi-spinner" /></div>

      <div v-else-if="assignments.length === 0" class="tab-empty">No plans assigned.</div>

      <div v-else class="assignment-list">
        <div v-for="a in assignments" :key="a.id" class="assignment-row" :class="{ inactive: !a.is_active }">
          <div class="asgn-body">
            <div class="asgn-name">{{ a.plan_name }}</div>
            <div class="asgn-meta">Since {{ fmtDate(a.started_at) }} · <span :class="a.is_active ? 'active-tag' : 'inactive-tag'">{{ a.is_active ? 'Active' : 'Inactive' }}</span></div>
          </div>
          <button v-if="a.is_active" class="btn-remove" @click="handleDeactivate(a.id)">
            <i class="pi pi-times" />
          </button>
        </div>
      </div>
    </div>

    <!-- Assign plan modal -->
    <div v-if="showAssignModal" class="modal-overlay" @click.self="showAssignModal = false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">ASSIGN PLAN</div>
          <button class="modal-close" @click="showAssignModal = false"><i class="pi pi-times" /></button>
        </div>
        <div class="modal-body">
          <div v-if="trainer.plans.length === 0" class="tab-empty">
            No plans yet. <button class="link-btn" @click="router.push('/trainer/plans')">Create one first.</button>
          </div>
          <div v-else class="plan-pick-list">
            <div
              v-for="p in trainer.plans"
              :key="p.id"
              class="plan-pick-row"
              @click="handleAssign(p.id)"
            >
              <div class="pp-name">{{ p.name }}</div>
              <div class="pp-days">{{ p.days.length }} day{{ p.days.length !== 1 ? 's' : '' }} assigned</div>
            </div>
          </div>
          <div v-if="assignError" class="fp-error">{{ assignError }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTrainerStore } from '@/stores/trainerStore'
import type { ClientSession, PlanAssignment } from '@/stores/trainerStore'
import { format, subWeeks, startOfWeek, endOfWeek, eachWeekOfInterval } from 'date-fns'

const props  = defineProps<{ clientId: string }>()
const router = useRouter()
const trainer = useTrainerStore()

const TABS = [{ id: 'history', label: 'History' }, { id: 'stats', label: 'Stats' }, { id: 'plans', label: 'Plans' }]
const activeTab      = ref('history')
const loadingHistory = ref(false)
const loadingAssignments = ref(false)
const sessions       = ref<ClientSession[]>([])
const assignments    = ref<PlanAssignment[]>([])
const selectedSession = ref<ClientSession | null>(null)
const feedbackDraft  = ref('')
const savingFeedback = ref(false)
const feedbackError  = ref('')
const showAssignModal = ref(false)
const assignError    = ref('')

const client = computed(() => trainer.clients.find(c => c.id === props.clientId))

function fmtDate(iso: string) { return format(new Date(iso), 'MMM d, yyyy') }
function formatDuration(secs: number) {
  const m = Math.floor(secs / 60); const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Stats computed
const totalVolume = computed(() =>
  Math.round(sessions.value.reduce((a, s) => a + s.total_volume, 0)).toLocaleString()
)
const weeklyAvg = computed(() => {
  if (!sessions.value.length) return '0'
  return (sessions.value.length / 8).toFixed(1)
})
const compliance = computed(() => {
  // sessions where template was started (compliance vs plan days) — simplified: sessions/week vs plan days assigned
  return '—'
})

const weekBars = computed(() => {
  const weeks = eachWeekOfInterval({ start: subWeeks(new Date(), 7), end: new Date() })
  const max = Math.max(1, ...weeks.map(w => {
    const end = endOfWeek(w)
    return sessions.value.filter(s => { const d = new Date(s.started_at); return d >= w && d <= end }).length
  }))
  return weeks.map(w => {
    const end = endOfWeek(w)
    const count = sessions.value.filter(s => { const d = new Date(s.started_at); return d >= w && d <= end }).length
    return { label: format(w, 'M/d'), count, pct: (count / max) * 100 }
  })
})

async function handleSaveFeedback() {
  if (!selectedSession.value || !feedbackDraft.value.trim()) return
  savingFeedback.value = true; feedbackError.value = ''
  const err = await trainer.saveFeedback(selectedSession.value.id, feedbackDraft.value.trim())
  savingFeedback.value = false
  if (err) { feedbackError.value = err; return }
  selectedSession.value.feedback = feedbackDraft.value.trim()
  selectedSession.value.feedback_id = 'saved'
  selectedSession.value = null
}

async function handleDeleteFeedback() {
  if (!selectedSession.value?.feedback_id) return
  await trainer.deleteFeedback(selectedSession.value.feedback_id)
  selectedSession.value.feedback = null; selectedSession.value.feedback_id = null
  selectedSession.value = null
}

async function handleDeactivate(id: string) {
  await trainer.deactivateAssignment(id)
  const a = assignments.value.find(x => x.id === id)
  if (a) a.is_active = false
}

async function handleAssign(planId: string) {
  assignError.value = ''
  const err = await trainer.assignPlan(planId, props.clientId)
  if (err) { assignError.value = err; return }
  showAssignModal.value = false
  await loadAssignments()
}

async function loadAssignments() {
  loadingAssignments.value = true
  assignments.value = await trainer.fetchClientAssignments(props.clientId)
  loadingAssignments.value = false
}

onMounted(async () => {
  loadingHistory.value = true
  await Promise.all([
    trainer.fetchPlans(),
    loadAssignments(),
  ])
  sessions.value = await trainer.fetchClientSessions(props.clientId)
  loadingHistory.value = false
})
</script>

<style scoped>
.view { padding: 0 0 100px; min-height: 100vh; }

.view-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1rem 1rem 0.75rem; border-bottom: 1px solid #252528;
}
.back-btn { background: none; border: none; color: #AEAEB2; cursor: pointer; font-size: 1.1rem; padding: 0.25rem; }
.header-body { display: flex; align-items: center; gap: 0.6rem; }
.client-name { font-family: 'Barlow Condensed', sans-serif; font-size: 1.4rem; font-weight: 900; color: #F0F0F0; }
.tier-chip { font-family: 'Barlow Condensed', sans-serif; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.12em; padding: 0.1rem 0.35rem; border: 1px solid; }
.tier-chip.free { color: #636366; border-color: #3A3A3C; }
.tier-chip.paid { color: #4DA6FF; border-color: rgba(77,166,255,0.3); }
.tier-chip.ultra { color: #FFD700; border-color: rgba(255,215,0,0.3); }

.tabs { display: flex; border-bottom: 1px solid #252528; }
.tab { flex: 1; padding: 0.75rem; background: none; border: none; color: #636366; cursor: pointer; font-family: 'Barlow Condensed', sans-serif; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.1em; transition: color 0.15s; }
.tab.active { color: #4A9EFF; border-bottom: 2px solid #4A9EFF; }


/* History */
.session-list { display: flex; flex-direction: column; }
.session-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.875rem 1rem; border-bottom: 1px solid #252528;
  cursor: pointer; transition: background 0.15s;
}
.session-row:hover { background: #252528; }
.sess-name { font-size: 0.9rem; color: #EBEBEB; font-weight: 500; }
.sess-meta { font-size: 0.7rem; color: #636366; margin-top: 0.15rem; }
.feedback-dot { color: #4A9EFF; font-size: 0.8rem; }

.feedback-panel {
  position: fixed; bottom: 64px; left: 0; right: 0; background: #1C1C1E;
  border-top: 1px solid #3A3A3C; padding: 1rem; z-index: 50;
  box-shadow: 0 -8px 24px rgba(0,0,0,0.5);
}
.fp-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
.fp-title { font-family: 'Barlow Condensed', sans-serif; font-size: 0.9rem; font-weight: 700; color: #F0F0F0; }
.fp-date { color: #8E8E93; font-weight: 400; }
.fp-close { background: none; border: none; color: #636366; cursor: pointer; }
.fp-stats { display: flex; gap: 1rem; font-size: 0.7rem; color: #636366; margin-bottom: 0.75rem; }
.feedback-textarea {
  width: 100%; background: #1C1C1E; border: 1px solid #3A3A3C; color: #EBEBEB;
  padding: 0.6rem 0.75rem; font-size: 0.85rem; resize: none; box-sizing: border-box;
  font-family: 'DM Sans', sans-serif;
}
.fp-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
.btn-save {
  background: #4A9EFF; border: none; color: #fff; padding: 0.5rem 1rem;
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.8rem; font-weight: 700;
  letter-spacing: 0.08em; cursor: pointer;
}
.btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-del {
  background: none; border: 1px solid #3A3A3C; color: #4A9EFF;
  padding: 0.5rem 0.75rem; font-size: 0.75rem; cursor: pointer; font-family: 'Barlow Condensed', sans-serif;
}
.fp-error { color: #4A9EFF; font-size: 0.75rem; margin-top: 0.4rem; }

/* Stats */
.stats-content { padding: 1rem; }
.kpi-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem; }
.kpi-card { background: #1C1C1E; border: 1px solid #252528; padding: 0.875rem; }
.kpi-val { font-family: 'Barlow Condensed', sans-serif; font-size: 1.6rem; font-weight: 900; color: #F0F0F0; }
.kpi-lbl { font-size: 0.62rem; color: #636366; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.2rem; }
.section-label { font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700; color: #8E8E93; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 0.75rem; }
.bar-chart { display: flex; align-items: flex-end; gap: 4px; height: 80px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; }
.bar-fill { width: 100%; min-height: 2px; background: rgba(74,158,255,0.6); transition: height 0.3s; }
.bar-lbl { font-size: 0.55rem; color: #8E8E93; }

/* Plans */
.plans-content { padding: 1rem; }
.plans-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
.assign-btn {
  display: flex; align-items: center; gap: 0.3rem;
  background: rgba(74,158,255,0.1); border: 1px solid rgba(74,158,255,0.3); color: #4A9EFF;
  padding: 0.35rem 0.75rem; font-size: 0.7rem; font-weight: 700;
  letter-spacing: 0.08em; cursor: pointer; font-family: 'Barlow Condensed', sans-serif;
}
.assignment-list { display: flex; flex-direction: column; gap: 1px; }
.assignment-row { display: flex; align-items: center; background: #1C1C1E; border: 1px solid #252528; padding: 0.875rem; }
.assignment-row.inactive { opacity: 0.5; }
.asgn-body { flex: 1; }
.asgn-name { font-size: 0.9rem; color: #EBEBEB; font-weight: 500; }
.asgn-meta { font-size: 0.7rem; color: #636366; margin-top: 0.2rem; }
.active-tag { color: #34C759; }
.inactive-tag { color: #636366; }
.btn-remove { background: none; border: 1px solid #3A3A3C; color: #636366; padding: 0.35rem 0.5rem; cursor: pointer; font-size: 0.8rem; }
.btn-remove:hover { color: #4A9EFF; border-color: rgba(74,158,255,0.3); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: flex-end; }
.modal { width: 100%; background: #1C1C1E; border-top: 1px solid #3A3A3C; border-radius: 0; max-height: 70vh; overflow-y: auto; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem; border-bottom: 1px solid #252528; }
.modal-title { font-family: 'Barlow Condensed', sans-serif; font-size: 1rem; font-weight: 800; color: #F0F0F0; letter-spacing: 0.08em; }
.modal-close { background: none; border: none; color: #636366; cursor: pointer; }
.modal-body { padding: 1rem; }
.plan-pick-list { display: flex; flex-direction: column; gap: 1px; }
.plan-pick-row { padding: 0.875rem; background: #1C1C1E; border: 1px solid #252528; cursor: pointer; }
.plan-pick-row:hover { border-color: #4A9EFF; }
.pp-name { font-size: 0.9rem; color: #EBEBEB; font-weight: 500; }
.pp-days { font-size: 0.7rem; color: #636366; margin-top: 0.15rem; }
.link-btn { background: none; border: none; color: #4A9EFF; cursor: pointer; font-size: inherit; padding: 0; }
</style>
