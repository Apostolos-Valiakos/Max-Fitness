<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">MY PLANS</h1>
        <div class="page-sub">Workout plans you've created for clients</div>
      </div>
      <Button @click="openCreatePanel">
        <i class="pi pi-plus" /> NEW PLAN
      </Button>
    </div>

    <div v-if="loading" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading...</div>

    <div v-else class="content-grid">
      <!-- LEFT: Plan list -->
      <div class="plans-col">
        <div v-if="plans.length === 0" class="empty-state">
          <i class="pi pi-list" />
          <p>No plans yet. Create your first workout plan.</p>
        </div>

        <div
          v-for="plan in plans"
          :key="plan.id"
          class="plan-card card"
          :class="{ selected: selectedPlan?.id === plan.id }"
          @click="selectPlan(plan)"
        >
          <div class="plan-card-header">
            <div>
              <div class="plan-name">{{ plan.name }}</div>
              <div class="plan-desc" v-if="plan.description">{{ plan.description }}</div>
            </div>
            <div class="plan-actions">
              <Button severity="danger" size="small" @click.stop="deletePlan(plan.id)">
                <i class="pi pi-trash" />
              </Button>
            </div>
          </div>
          <div class="plan-days-summary">
            <span v-for="day in DAYS" :key="day.dow" class="day-pip" :class="{ filled: hasDayTemplate(plan, day.dow) }" :title="day.label">
              {{ day.short }}
            </span>
          </div>
          <div class="plan-assignments">
            {{ assignmentCount(plan.id) }} client{{ assignmentCount(plan.id) !== 1 ? 's' : '' }} assigned
          </div>
        </div>
      </div>

      <!-- RIGHT: Plan detail (week builder + assignments) -->
      <div class="detail-col" v-if="selectedPlan">
        <!-- Week builder -->
        <div class="card detail-section">
          <div class="section-title">WEEKLY SCHEDULE — {{ selectedPlan.name }}</div>
          <div class="week-grid">
            <div v-for="day in DAYS" :key="day.dow" class="week-day">
              <div class="week-day-label">{{ day.label }}</div>
              <div v-if="getDayTemplate(selectedPlan, day.dow)" class="week-day-assigned">
                <span class="week-tmpl-name">{{ getDayTemplate(selectedPlan, day.dow)?.template_name }}</span>
                <Button severity="secondary" size="small" @click="clearDay(selectedPlan!.id, day.dow)">
                  <i class="pi pi-times" />
                </Button>
              </div>
              <div v-else class="week-day-empty">
                <Select
                  :options="[{ label: '— Rest day —', value: '' }, ...myTemplates.map(t => ({ label: t.name, value: t.id }))]"
                  option-label="label"
                  option-value="value"
                  placeholder="— Rest day —"
                  style="width:100%;font-size:0.78rem"
                  @update:model-value="(val: string) => { if (val) onDayTemplateChange(selectedPlan!.id, day.dow, val) }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Client assignments -->
        <div class="card detail-section">
          <div class="detail-header">
            <div class="section-title">CLIENT ASSIGNMENTS</div>
            <Button size="small" @click="showAssignClient = true">
              <i class="pi pi-plus" /> ASSIGN
            </Button>
          </div>

          <div v-if="planAssignments.length === 0" class="no-data">No clients assigned to this plan.</div>

          <DataTable v-else :value="planAssignments">
            <Column field="client_id" header="Client">
              <template #body="{ data }">
                <span class="td-name">{{ clientName(data.client_id) }}</span>
              </template>
            </Column>
            <Column field="started_at" header="Since">
              <template #body="{ data }">
                <span class="td-muted">{{ fmtDate(data.started_at) }}</span>
              </template>
            </Column>
            <Column field="is_active" header="Status">
              <template #body="{ data }">
                <span class="badge" :class="data.is_active ? 'admin' : 'user'">
                  {{ data.is_active ? 'Active' : 'Inactive' }}
                </span>
              </template>
            </Column>
            <Column header="">
              <template #body="{ data }">
                <Button v-if="data.is_active" severity="danger" size="small" @click="deactivateAssignment(data.id)">
                  <i class="pi pi-times" />
                </Button>
              </template>
            </Column>
          </DataTable>
        </div>

        <!-- Recent session reviews -->
        <div class="card detail-section">
          <div class="section-title">RECENT CLIENT SESSIONS</div>
          <div v-if="recentSessions.length === 0" class="no-data">No sessions from assigned clients yet.</div>
          <DataTable v-else :value="recentSessions" row-hover @row-click="(e: any) => openFeedback(e.data)" class="sess-table">
            <Column field="user_id" header="Client">
              <template #body="{ data }">
                <span class="td-name">{{ clientName(data.user_id) }}</span>
              </template>
            </Column>
            <Column field="name" header="Session" />
            <Column field="started_at" header="Date">
              <template #body="{ data }">
                <span class="td-muted">{{ fmtDate(data.started_at) }}</span>
              </template>
            </Column>
            <Column field="total_sets" header="Sets">
              <template #body="{ data }">
                <span class="td-val">{{ data.total_sets }}</span>
              </template>
            </Column>
            <Column field="total_volume" header="Volume">
              <template #body="{ data }">
                <span class="td-val">{{ Math.round(data.total_volume).toLocaleString() }}</span>
              </template>
            </Column>
            <Column field="id" header="Feedback">
              <template #body="{ data }">
                <span v-if="feedbackMap[data.id]" class="badge admin"><i class="pi pi-check" /></span>
                <span v-else class="badge user">—</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>

      <div v-else class="detail-col detail-placeholder">
        <div class="placeholder-inner">
          <i class="pi pi-arrow-left" />
          <p>Select a plan to edit its schedule and assignments</p>
        </div>
      </div>
    </div>

    <!-- Create plan Drawer -->
    <Drawer v-model:visible="showCreatePanel" position="right" header="NEW PLAN" :style="{ width: '480px' }">
      <div class="panel-body">
        <div class="field">
          <label class="mf-label">PLAN NAME</label>
          <InputText v-model="createForm.name" placeholder="e.g. 3-Day PPL" style="width:100%" />
        </div>
        <div class="field">
          <label class="mf-label">DESCRIPTION (optional)</label>
          <Textarea v-model="createForm.description" :rows="3" placeholder="Brief description…" style="width:100%" />
        </div>
        <div v-if="createError" class="field-error">{{ createError }}</div>
      </div>
      <template #footer>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <Button severity="secondary" @click="showCreatePanel = false">Cancel</Button>
          <Button @click="handleCreate" :disabled="!createForm.name.trim() || creating">
            {{ creating ? 'Creating…' : 'CREATE' }}
          </Button>
        </div>
      </template>
    </Drawer>

    <!-- Assign client Drawer -->
    <Drawer v-model:visible="showAssignClient" position="right" header="ASSIGN CLIENT" :style="{ width: '480px' }">
      <div class="panel-body">
        <div class="field">
          <label class="mf-label">SELECT CLIENT</label>
          <Select
            v-model="assignClientId"
            :options="[{ label: 'Choose a client…', value: '' }, ...myClients.map(c => ({ label: c.full_name ?? c.email, value: c.id }))]"
            option-label="label"
            option-value="value"
            style="width:100%"
          />
        </div>
        <div v-if="assignError" class="field-error">{{ assignError }}</div>
      </div>
      <template #footer>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <Button severity="secondary" @click="showAssignClient = false">Cancel</Button>
          <Button :disabled="!assignClientId" @click="handleAssign">ASSIGN</Button>
        </div>
      </template>
    </Drawer>

    <!-- Feedback Drawer -->
    <Drawer v-model:visible="feedbackDrawerVisible" position="right" header="SESSION FEEDBACK" :style="{ width: '480px' }">
      <div class="panel-body" v-if="feedbackSession">
        <div class="feedback-session-info">
          <div class="fs-name">{{ feedbackSession.name }}</div>
          <div class="fs-meta">{{ clientName(feedbackSession.user_id) }} · {{ fmtDate(feedbackSession.started_at) }}</div>
          <div class="fs-stats">{{ feedbackSession.total_sets }} sets · {{ Math.round(feedbackSession.total_volume).toLocaleString() }} kg</div>
        </div>
        <div class="field">
          <label class="mf-label">YOUR FEEDBACK</label>
          <Textarea v-model="feedbackContent" :rows="5" placeholder="Leave feedback for this session…" style="width:100%" />
        </div>
        <div v-if="feedbackError" class="field-error">{{ feedbackError }}</div>
      </div>
      <template #footer>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <Button v-if="feedbackSession && feedbackMap[feedbackSession.id]" severity="danger" @click="handleDeleteFeedback">Delete</Button>
          <Button severity="secondary" @click="feedbackDrawerVisible = false">Cancel</Button>
          <Button @click="handleSaveFeedback" :disabled="!feedbackContent.trim() || savingFeedback">
            {{ savingFeedback ? 'Saving…' : 'SAVE' }}
          </Button>
        </div>
      </template>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { listAuthUsers } from '@/lib/adminSupabase'
import { fmtDate } from '@/lib/utils'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Drawer from 'primevue/drawer'

interface Plan {
  id: string; trainer_id: string; name: string; description: string | null
  days: { day_of_week: number; template_id: string; template_name: string }[]
}
interface Assignment { id: string; plan_id: string; client_id: string; is_active: boolean; started_at: string }
interface SessionRow { id: string; user_id: string; name: string; started_at: string; total_sets: number; total_volume: number }
interface Client { id: string; full_name: string | null; email: string }

const DAYS = [
  { dow: 1, short: 'M', label: 'Monday' },    { dow: 2, short: 'T', label: 'Tuesday' },
  { dow: 3, short: 'W', label: 'Wednesday' },  { dow: 4, short: 'T', label: 'Thursday' },
  { dow: 5, short: 'F', label: 'Friday' },     { dow: 6, short: 'S', label: 'Saturday' },
  { dow: 0, short: 'S', label: 'Sunday' },
]

const loading        = ref(true)
const plans          = ref<Plan[]>([])
const allAssignments = ref<Assignment[]>([])
const myClients      = ref<Client[]>([])
const myTemplates    = ref<{ id: string; name: string }[]>([])
const recentSessions = ref<SessionRow[]>([])
const feedbackMap    = ref<Record<string, { id: string; content: string }>>({})
const selectedPlan   = ref<Plan | null>(null)
const showCreatePanel = ref(false)
const showAssignClient = ref(false)
const creating       = ref(false)
const createError    = ref('')
const assignClientId = ref('')
const assignError    = ref('')
const feedbackSession = ref<SessionRow | null>(null)
const feedbackDrawerVisible = ref(false)
const feedbackContent = ref('')
const feedbackError  = ref('')
const savingFeedback = ref(false)
const createForm     = reactive({ name: '', description: '' })

const planAssignments = computed(() =>
  allAssignments.value.filter(a => a.plan_id === selectedPlan.value?.id)
)

function hasDayTemplate(plan: Plan, dow: number) { return plan.days.some(d => d.day_of_week === dow) }
function getDayTemplate(plan: Plan, dow: number) { return plan.days.find(d => d.day_of_week === dow) }
function assignmentCount(planId: string) { return allAssignments.value.filter(a => a.plan_id === planId && a.is_active).length }
function clientName(id: string) { return myClients.value.find(c => c.id === id)?.full_name ?? '—' }
async function load() {
  loading.value = true
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { loading.value = false; return }

  const [plansRes, assignRes, templRes, taRes] = await Promise.all([
    supabase.from('workout_plans').select('*, plan_day_templates(day_of_week, template_id, workout_templates(name))').eq('trainer_id', user.id).order('created_at', { ascending: false }),
    supabase.from('client_plan_assignments').select('*').eq('trainer_id', user.id),
    supabase.from('workout_templates').select('id, name').eq('owner_id', user.id).order('name'),
    supabase.from('trainer_assignments').select('client_id, profiles!trainer_assignments_client_id_fkey(id, full_name)').eq('trainer_id', user.id).eq('is_active', true),
  ])

  plans.value = (plansRes.data ?? []).map(p => ({
    id: p.id, trainer_id: p.trainer_id, name: p.name, description: p.description,
    days: (p.plan_day_templates ?? []).map((d: any) => ({
      day_of_week: d.day_of_week, template_id: d.template_id, template_name: d.workout_templates?.name ?? '',
    })).sort((a: any, b: any) => a.day_of_week - b.day_of_week),
  }))

  allAssignments.value = assignRes.data ?? []
  myTemplates.value = templRes.data ?? []

  // Build client list from trainer_assignments
  const authUsers = await listAuthUsers().catch(() => [])
  const emailMap = Object.fromEntries(authUsers.map(u => [u.id, u.email]))
  myClients.value = (taRes.data ?? []).map(ta => {
    const p = ta.profiles as any
    return { id: p.id, full_name: p.full_name, email: emailMap[p.id] ?? '' }
  })

  loading.value = false
}

async function selectPlan(plan: Plan) {
  selectedPlan.value = plan
  await loadRecentSessions()
}

async function loadRecentSessions() {
  if (!selectedPlan.value) return
  const clientIds = allAssignments.value.filter(a => a.plan_id === selectedPlan.value!.id && a.is_active).map(a => a.client_id)
  if (!clientIds.length) { recentSessions.value = []; return }

  const { data: sessions } = await supabase
    .from('workout_sessions').select('id, user_id, name, started_at')
    .in('user_id', clientIds).not('finished_at', 'is', null).eq('deleted', false)
    .order('started_at', { ascending: false }).limit(20)

  if (!sessions?.length) { recentSessions.value = []; return }
  const ids = sessions.map(s => s.id)

  const [setsRes, fbRes] = await Promise.all([
    supabase.from('sets').select('session_id, weight_kg, reps').in('session_id', ids),
    supabase.from('session_feedback').select('id, session_id, content').in('session_id', ids),
  ])

  const setsMap: Record<string, { count: number; vol: number }> = {}
  for (const s of setsRes.data ?? []) {
    if (!setsMap[s.session_id]) setsMap[s.session_id] = { count: 0, vol: 0 }
    setsMap[s.session_id].count++
    setsMap[s.session_id].vol += (s.weight_kg ?? 0) * (s.reps ?? 0)
  }
  feedbackMap.value = {}
  for (const f of fbRes.data ?? []) feedbackMap.value[f.session_id] = { id: f.id, content: f.content }

  recentSessions.value = sessions.map(s => ({
    id: s.id, user_id: s.user_id, name: s.name, started_at: s.started_at,
    total_sets: setsMap[s.id]?.count ?? 0, total_volume: setsMap[s.id]?.vol ?? 0,
  }))
}

function openCreatePanel() {
  createForm.name = ''; createForm.description = ''; createError.value = ''
  showCreatePanel.value = true
}

async function handleCreate() {
  creating.value = true; createError.value = ''
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { creating.value = false; return }
  const { data, error } = await supabase.from('workout_plans').insert({
    trainer_id: user.id, name: createForm.name.trim(), description: createForm.description.trim() || null
  }).select().single()
  creating.value = false
  if (error) { createError.value = error.message; return }
  plans.value.unshift({ ...data, days: [] })
  showCreatePanel.value = false
}

async function deletePlan(id: string) {
  await supabase.from('workout_plans').delete().eq('id', id)
  plans.value = plans.value.filter(p => p.id !== id)
  if (selectedPlan.value?.id === id) selectedPlan.value = null
}

async function onDayTemplateChange(planId: string, dow: number, templateId: string) {
  if (!templateId) return
  const tmpl = myTemplates.value.find(t => t.id === templateId)
  await supabase.from('plan_day_templates').upsert({ plan_id: planId, day_of_week: dow, template_id: templateId }, { onConflict: 'plan_id,day_of_week' })
  const plan = plans.value.find(p => p.id === planId)
  if (plan) {
    const ex = plan.days.find(d => d.day_of_week === dow)
    if (ex) { ex.template_id = templateId; ex.template_name = tmpl?.name ?? '' }
    else plan.days.push({ day_of_week: dow, template_id: templateId, template_name: tmpl?.name ?? '' })
    plan.days.sort((a, b) => a.day_of_week - b.day_of_week)
  }
}

async function clearDay(planId: string, dow: number) {
  await supabase.from('plan_day_templates').delete().eq('plan_id', planId).eq('day_of_week', dow)
  const plan = plans.value.find(p => p.id === planId)
  if (plan) plan.days = plan.days.filter(d => d.day_of_week !== dow)
}

async function handleAssign() {
  assignError.value = ''
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !selectedPlan.value) return
  const { error } = await supabase.from('client_plan_assignments').upsert(
    { plan_id: selectedPlan.value.id, client_id: assignClientId.value, trainer_id: user.id, is_active: true },
    { onConflict: 'plan_id,client_id' }
  )
  if (error) { assignError.value = error.message; return }
  showAssignClient.value = false; assignClientId.value = ''
  await load()
  selectedPlan.value = plans.value.find(p => p.id === selectedPlan.value?.id) ?? null
}

async function deactivateAssignment(id: string) {
  await supabase.from('client_plan_assignments').update({ is_active: false }).eq('id', id)
  const a = allAssignments.value.find(x => x.id === id)
  if (a) a.is_active = false
}

function openFeedback(session: SessionRow) {
  feedbackSession.value = session
  feedbackContent.value = feedbackMap.value[session.id]?.content ?? ''
  feedbackError.value = ''
  feedbackDrawerVisible.value = true
}

async function handleSaveFeedback() {
  if (!feedbackSession.value) return
  savingFeedback.value = true; feedbackError.value = ''
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { savingFeedback.value = false; return }
  const { error } = await supabase.from('session_feedback').upsert(
    { session_id: feedbackSession.value.id, trainer_id: user.id, content: feedbackContent.value.trim() },
    { onConflict: 'session_id,trainer_id' }
  )
  savingFeedback.value = false
  if (error) { feedbackError.value = error.message; return }
  feedbackMap.value[feedbackSession.value.id] = { id: 'saved', content: feedbackContent.value.trim() }
  feedbackDrawerVisible.value = false
  feedbackSession.value = null
}

async function handleDeleteFeedback() {
  if (!feedbackSession.value) return
  const fb = feedbackMap.value[feedbackSession.value.id]
  if (fb) await supabase.from('session_feedback').delete().eq('session_id', feedbackSession.value.id)
  delete feedbackMap.value[feedbackSession.value.id]
  feedbackDrawerVisible.value = false
  feedbackSession.value = null
}

onMounted(load)
</script>

<style scoped>
.content-grid { display: grid; grid-template-columns: 300px 1fr; gap: 1rem; align-items: start; }

/* Left col */
.plans-col { display: flex; flex-direction: column; gap: 0.75rem; }
.empty-state { padding: 2rem; }
.empty-state i { font-size: 2rem; margin-bottom: 0.75rem; }
.plan-card { padding: 1rem; cursor: pointer; border: 1px solid var(--surface); transition: border-color 0.15s; }
.plan-card.selected { border-color: var(--accent); }
.plan-card:hover { border-color: var(--border); }
.plan-card-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.6rem; }
.plan-name { font-family: 'Barlow Condensed', sans-serif; font-size: 1rem; font-weight: 800; color: var(--text); }
.plan-desc { font-size: 0.7rem; color: var(--muted); margin-top: 0.15rem; }
.plan-days-summary { display: flex; gap: 4px; margin-bottom: 0.5rem; }
.day-pip { font-family: 'Barlow Condensed', sans-serif; font-size: 0.6rem; font-weight: 700; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border); color: var(--border); }
.day-pip.filled { border-color: rgba(74,158,255,0.5); color: var(--accent); background: rgba(74,158,255,0.1); }
.plan-assignments { font-size: 0.68rem; color: var(--muted); }

/* Right col */
.detail-col { display: flex; flex-direction: column; gap: 1rem; }
.detail-placeholder { align-items: center; justify-content: center; min-height: 200px; display: flex; }
.placeholder-inner { text-align: center; color: var(--border); }
.placeholder-inner i { font-size: 1.5rem; margin-bottom: 0.5rem; }
.placeholder-inner p { font-size: 0.82rem; }

.detail-section { padding: 1.25rem; }
.detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.875rem; }

/* Week grid */
.week-grid { display: flex; flex-direction: column; gap: 0.5rem; }
.week-day { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: 0.75rem; }
.week-day-label { font-family: 'Barlow Condensed', sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; color: var(--muted); }
.week-day-assigned { display: flex; align-items: center; justify-content: space-between; background: rgba(74,158,255,0.08); border: 1px solid rgba(74,158,255,0.25); padding: 0.35rem 0.6rem; }
.week-tmpl-name { font-size: 0.78rem; color: var(--accent); }
.no-data { font-size: 0.82rem; color: var(--border); padding: 0.75rem 0; }

/* Session table */
.td-name  { color: #C7C7CC; font-weight: 500; }
.td-muted { color: var(--muted); font-size: 0.78rem; }
.td-val   { color: #AEAEB2; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }

.panel-body { display: flex; flex-direction: column; gap: 1.25rem; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field-error { font-size: 0.78rem; color: var(--accent); }

.feedback-session-info { background: var(--bg); border: 1px solid var(--surface); padding: 0.875rem; }
.fs-name { font-family: 'Barlow Condensed', sans-serif; font-size: 1rem; font-weight: 700; color: var(--text); }
.fs-meta { font-size: 0.72rem; color: var(--muted); margin-top: 0.2rem; }
.fs-stats { font-size: 0.72rem; color: var(--muted); margin-top: 0.15rem; }
</style>
