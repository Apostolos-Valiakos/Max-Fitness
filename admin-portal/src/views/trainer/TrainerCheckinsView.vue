<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">CHECK-INS</h1>
        <div class="page-sub">
          <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }} new</span>
          Manage templates, assignments and review submissions
        </div>
      </div>
      <Button @click="openCreateTemplate"><i class="pi pi-plus" /> NEW TEMPLATE</Button>
    </div>

    <div v-if="loading" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading...</div>

    <template v-else>
      <Tabs v-model:value="tab">
        <TabList>
          <Tab value="submissions">
            SUBMISSIONS <span v-if="unreadCount" class="tab-badge">{{ unreadCount }}</span>
          </Tab>
          <Tab value="assignments">ASSIGNMENTS</Tab>
          <Tab value="templates">TEMPLATES</Tab>
        </TabList>
        <TabPanels>

          <!-- SUBMISSIONS tab -->
          <TabPanel value="submissions">
            <div v-if="!submissions.length" class="empty-state card">
              <i class="pi pi-inbox empty-icon" />
              <div class="empty-title">No submissions yet</div>
            </div>
            <div v-else class="submission-list">
              <div v-for="s in submissions" :key="s.id" class="submission-card card" :class="{ unread: !s.is_read }">
                <div class="sub-header">
                  <div class="sub-client">{{ clientName(s.client_id) }}</div>
                  <div class="sub-date">{{ fmtDate(s.submitted_at) }}</div>
                  <span v-if="!s.is_read" class="new-dot" />
                </div>
                <div class="sub-template">{{ templateName(s.assignment_id) }}</div>
                <div class="sub-answers">
                  <div v-for="(val, qid) in s.answers" :key="qid" class="answer-row">
                    <span class="answer-label">{{ questionLabel(s.assignment_id, String(qid)) }}</span>
                    <span class="answer-val">{{ formatAnswer(val) }}</span>
                  </div>
                </div>
                <div v-if="s.photo_urls?.length && !s.photos_deleted && signedPhotoUrls[s.id]?.length" class="sub-photos">
                  <a
                    v-for="(url, idx) in signedPhotoUrls[s.id]" :key="idx"
                    :href="url" target="_blank" rel="noopener"
                  >
                    <img :src="url" class="sub-photo" :alt="`Photo ${idx + 1}`" />
                  </a>
                  <div class="photo-warning">Photos will be deleted after you reply.</div>
                </div>
                <div v-if="s.photos_deleted && s.trainer_reply" class="photo-deleted-note">
                  <i class="pi pi-info-circle" /> Photos were deleted after review was completed.
                </div>
                <div v-if="s.trainer_reply" class="reply-box">
                  <div class="reply-label">YOUR REPLY</div>
                  <div class="reply-text">{{ s.trainer_reply }}</div>
                </div>
                <div v-else class="reply-form">
                  <Textarea v-model="replyDraft[s.id]" class="reply-textarea" :rows="2" placeholder="Write a reply to your client…" style="width:100%" />
                  <Button size="small" class="reply-btn" :disabled="!replyDraft[s.id]?.trim()" @click="submitReply(s)">
                    SEND REPLY
                  </Button>
                </div>
              </div>
            </div>
          </TabPanel>

          <!-- ASSIGNMENTS tab -->
          <TabPanel value="assignments">
            <div class="assign-actions">
              <Button severity="secondary" @click="openAssign"><i class="pi pi-plus" /> ASSIGN TEMPLATE</Button>
            </div>
            <div class="card table-wrap">
              <DataTable :value="assignments" :paginator="assignments.length > 10" :rows="25">
                <Column field="client_id" header="Client">
                  <template #body="{ data }">
                    <span class="td-name">{{ clientName(data.client_id) }}</span>
                  </template>
                </Column>
                <Column field="template_id" header="Template">
                  <template #body="{ data }">
                    <span class="td-muted">{{ assignments_templateName(data.template_id) }}</span>
                  </template>
                </Column>
                <Column field="frequency" header="Frequency">
                  <template #body="{ data }">
                    <span class="td-muted">{{ data.frequency }}</span>
                  </template>
                </Column>
                <Column field="next_due_at" header="Next Due">
                  <template #body="{ data }">
                    <span class="td-muted">{{ data.next_due_at ? fmtDate(data.next_due_at) : '—' }}</span>
                  </template>
                </Column>
                <Column field="is_active" header="Status">
                  <template #body="{ data }">
                    <span class="status-badge" :class="data.is_active ? 'active' : 'inactive'">
                      {{ data.is_active ? 'Active' : 'Paused' }}
                    </span>
                  </template>
                </Column>
                <Column header="">
                  <template #body="{ data }">
                    <div class="td-actions">
                      <Button severity="secondary" size="small" @click="toggleAssignment(data)">
                        <i class="pi" :class="data.is_active ? 'pi-pause' : 'pi-play'" />
                      </Button>
                      <Button severity="danger" size="small" @click="deleteAssignment(data.id)"><i class="pi pi-trash" /></Button>
                    </div>
                  </template>
                </Column>
              </DataTable>
            </div>
          </TabPanel>

          <!-- TEMPLATES tab -->
          <TabPanel value="templates">
            <div class="card table-wrap">
              <DataTable :value="templates" :paginator="templates.length > 10" :rows="25">
                <Column field="name" header="Name">
                  <template #body="{ data }">
                    <span class="td-name">{{ data.name }}</span>
                  </template>
                </Column>
                <Column field="questions" header="Questions">
                  <template #body="{ data }">
                    <span class="td-val">{{ data.questions?.length ?? 0 }}</span>
                  </template>
                </Column>
                <Column field="description" header="Description">
                  <template #body="{ data }">
                    <span class="td-muted">{{ data.description ?? '—' }}</span>
                  </template>
                </Column>
                <Column header="">
                  <template #body="{ data }">
                    <div class="td-actions">
                      <Button severity="secondary" size="small" @click="openEditTemplate(data)"><i class="pi pi-pencil" /></Button>
                      <Button severity="secondary" size="small" @click="openAssignFrom(data)"><i class="pi pi-send" /></Button>
                      <Button severity="danger" size="small" @click="deleteTemplate(data.id)"><i class="pi pi-trash" /></Button>
                    </div>
                  </template>
                </Column>
              </DataTable>
            </div>
          </TabPanel>

        </TabPanels>
      </Tabs>
    </template>

    <!-- Template create/edit Drawer -->
    <Drawer v-model:visible="templatePanelVisible" position="right" :header="editingTemplateId ? 'EDIT TEMPLATE' : 'NEW TEMPLATE'" :style="{ width: '480px' }">
      <div class="panel-body">
        <div class="field">
          <label class="mf-label">TEMPLATE NAME</label>
          <InputText v-model="tForm.name" placeholder="e.g. Weekly Check-in" style="width:100%" />
        </div>
        <div class="field">
          <label class="mf-label">DESCRIPTION</label>
          <Textarea v-model="tForm.description" :rows="2" placeholder="What this check-in covers…" style="width:100%" />
        </div>

        <div class="field">
          <label class="mf-label">QUESTIONS</label>
          <div class="q-list">
            <div v-for="(q, qi) in tForm.questions" :key="q.id" class="q-row">
              <div class="q-row-top">
                <span class="q-num">{{ qi + 1 }}</span>
                <Select v-model="q.type" :options="QUESTION_TYPES" option-label="label" option-value="value" class="q-type" />
                <label class="q-req"><input type="checkbox" v-model="q.required" /> Required</label>
                <div class="q-row-actions">
                  <button class="icon-btn" :disabled="qi === 0" @click="moveQ(qi, -1)"><i class="pi pi-arrow-up" /></button>
                  <button class="icon-btn" :disabled="qi === tForm.questions.length - 1" @click="moveQ(qi, 1)"><i class="pi pi-arrow-down" /></button>
                  <button class="icon-btn danger" @click="removeQ(qi)"><i class="pi pi-times" /></button>
                </div>
              </div>
              <InputText v-model="q.label" :placeholder="`Question label (e.g. ${QUESTION_TYPES.find(t => t.value === q.type)?.placeholder ?? ''})`" style="width:100%" />
            </div>
          </div>
          <Button severity="secondary" size="small" class="add-q-btn" @click="addQuestion"><i class="pi pi-plus" /> ADD QUESTION</Button>
        </div>
      </div>
      <template #footer>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <Button severity="secondary" @click="templatePanelVisible = false">Cancel</Button>
          <Button :disabled="!tForm.name.trim()" @click="saveTemplate">
            {{ editingTemplateId ? 'SAVE' : 'CREATE' }}
          </Button>
        </div>
      </template>
    </Drawer>

    <!-- Assign Drawer -->
    <Drawer v-model:visible="assignPanel" position="right" header="ASSIGN CHECK-IN" :style="{ width: '420px' }">
      <div class="panel-body">
        <div class="field">
          <label class="mf-label">TEMPLATE</label>
          <Select v-model="aForm.template_id" :options="templates" option-label="name" option-value="id" style="width:100%" />
        </div>
        <div class="field">
          <label class="mf-label">CLIENT</label>
          <Select
            v-model="aForm.client_id"
            :options="clients.map(c => ({ label: c.full_name ?? c.id.slice(0, 8), value: c.id }))"
            option-label="label"
            option-value="value"
            style="width:100%"
          />
        </div>
        <div class="field">
          <label class="mf-label">FREQUENCY</label>
          <Select
            v-model="aForm.frequency"
            :options="[{ label: 'Weekly', value: 'weekly' }, { label: 'Bi-weekly', value: 'biweekly' }, { label: 'Monthly', value: 'monthly' }, { label: 'Manual only', value: 'manual' }]"
            option-label="label"
            option-value="value"
            style="width:100%"
          />
        </div>
        <div class="field" v-if="aForm.frequency !== 'manual'">
          <label class="mf-label">PREFERRED DAY</label>
          <Select
            v-model.number="aForm.day_of_week"
            :options="DAYS.map((d, i) => ({ label: d, value: i }))"
            option-label="label"
            option-value="value"
            style="width:100%"
          />
        </div>
        <div class="field">
          <label class="mf-label">FIRST DUE DATE</label>
          <InputText v-model="aForm.next_due_at" type="datetime-local" style="width:100%" />
        </div>
      </div>
      <template #footer>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <Button severity="secondary" @click="assignPanel = false">Cancel</Button>
          <Button :disabled="!aForm.template_id || !aForm.client_id" @click="saveAssignment">ASSIGN</Button>
        </div>
      </template>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { format } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Drawer from 'primevue/drawer'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'

const QUESTION_TYPES = [
  { value: 'weight',    label: 'Body Weight',       placeholder: 'Current body weight (kg)' },
  { value: 'scale',     label: 'Scale 1–10',        placeholder: 'How is your energy level? (1–10)' },
  { value: 'adherence', label: 'Session Adherence', placeholder: 'Did you complete all sessions?' },
  { value: 'free_text', label: 'Free Text',         placeholder: 'Any notes or comments?' },
  { value: 'number',    label: 'Number',            placeholder: 'Custom number field' },
  { value: 'photo',     label: 'Photo Upload',      placeholder: 'Progress photo (front)' },
  { value: 'yes_no',    label: 'Yes / No',          placeholder: 'Did you follow the diet plan?' },
]
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const auth    = useAuthStore()
const route   = useRoute()
const loading = ref(true)
const tab     = ref<string>('submissions')

const templates   = ref<any[]>([])
const assignments = ref<any[]>([])
const submissions = ref<any[]>([])
const clients     = ref<{ id: string; full_name: string | null }[]>([])
const replyDraft  = ref<Record<string, string>>({})
// submission id → signed URLs (1-hour expiry)
const signedPhotoUrls = ref<Record<string, string[]>>({})
const templatePanelVisible = ref(false)
const assignPanel    = ref(false)
const editingTemplateId = ref<string | null>(null)

const tForm = reactive({ name: '', description: '', questions: [] as any[] })
const aForm = reactive({ template_id: '', client_id: '', frequency: 'weekly', day_of_week: 0, next_due_at: '' })

const unreadCount = computed(() => submissions.value.filter(s => !s.is_read && !s.trainer_reply).length)

function fmtDate(iso: string) { return format(new Date(iso), 'MMM d, yyyy') }
function clientName(id: string) { return clients.value.find(c => c.id === id)?.full_name ?? id.slice(0, 8) }
function templateName(assignmentId: string) {
  const a = assignments.value.find(a => a.id === assignmentId)
  return templates.value.find(t => t.id === a?.template_id)?.name ?? '—'
}
function assignments_templateName(tid: string) { return templates.value.find(t => t.id === tid)?.name ?? '—' }
function questionLabel(assignmentId: string, qid: string) {
  const a = assignments.value.find(a => a.id === assignmentId)
  const t = templates.value.find(t => t.id === a?.template_id)
  return t?.questions?.find((q: any) => q.id === qid)?.label ?? qid
}
function formatAnswer(val: any) {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  return String(val)
}
async function generateSignedUrls(subs: any[]) {
  // Collect all paths that still have photos
  const subsWithPhotos = subs.filter(s => s.photo_urls?.length && !s.photos_deleted)
  await Promise.all(subsWithPhotos.map(async s => {
    const { data } = await supabase.storage
      .from('checkin-photos')
      .createSignedUrls(s.photo_urls, 3600) // 1-hour expiry
    signedPhotoUrls.value[s.id] = (data ?? []).map((d: any) => d.signedUrl ?? '')
  }))
}

function addQuestion() {
  tForm.questions.push({ id: uuidv4(), type: 'free_text', label: '', required: false })
}
function moveQ(idx: number, dir: -1 | 1) {
  const arr = tForm.questions; const ni = idx + dir
  if (ni >= 0 && ni < arr.length) [arr[idx], arr[ni]] = [arr[ni], arr[idx]]
}
function removeQ(idx: number) { tForm.questions.splice(idx, 1) }

function openCreateTemplate() {
  editingTemplateId.value = null; tForm.name = ''; tForm.description = ''; tForm.questions = []
  addQuestion(); templatePanelVisible.value = true
}
function openEditTemplate(t: any) {
  editingTemplateId.value = t.id; tForm.name = t.name; tForm.description = t.description ?? ''; tForm.questions = JSON.parse(JSON.stringify(t.questions ?? []))
  templatePanelVisible.value = true
}
function openAssign() { aForm.template_id = ''; aForm.client_id = route.query.client as string ?? ''; aForm.frequency = 'weekly'; aForm.day_of_week = 0; aForm.next_due_at = ''; assignPanel.value = true }
function openAssignFrom(t: any) { aForm.template_id = t.id; aForm.client_id = route.query.client as string ?? ''; aForm.frequency = 'weekly'; aForm.day_of_week = 0; aForm.next_due_at = ''; assignPanel.value = true }

async function saveTemplate() {
  const trainerId = auth.user?.id; if (!trainerId) return
  const payload = { trainer_id: trainerId, name: tForm.name.trim(), description: tForm.description.trim() || null, questions: tForm.questions, updated_at: new Date().toISOString() }
  if (editingTemplateId.value) {
    await supabase.from('checkin_templates').update(payload).eq('id', editingTemplateId.value)
    const idx = templates.value.findIndex(t => t.id === editingTemplateId.value)
    if (idx >= 0) templates.value[idx] = { ...templates.value[idx], ...payload }
  } else {
    const { data } = await supabase.from('checkin_templates').insert({ id: uuidv4(), ...payload }).select().single()
    if (data) templates.value.unshift(data)
  }
  templatePanelVisible.value = false
}

async function deleteTemplate(id: string) {
  await supabase.from('checkin_templates').delete().eq('id', id)
  templates.value = templates.value.filter(t => t.id !== id)
}

async function saveAssignment() {
  const trainerId = auth.user?.id; if (!trainerId) return
  const { data } = await supabase.from('checkin_assignments').insert({
    id: uuidv4(), template_id: aForm.template_id, client_id: aForm.client_id, trainer_id: trainerId,
    frequency: aForm.frequency, day_of_week: aForm.frequency !== 'manual' ? aForm.day_of_week : null,
    next_due_at: aForm.next_due_at || null, is_active: true,
  }).select().single()
  if (data) assignments.value.unshift(data)
  assignPanel.value = false
}

async function toggleAssignment(a: any) {
  await supabase.from('checkin_assignments').update({ is_active: !a.is_active }).eq('id', a.id)
  a.is_active = !a.is_active
}

async function deleteAssignment(id: string) {
  await supabase.from('checkin_assignments').delete().eq('id', id)
  assignments.value = assignments.value.filter(a => a.id !== id)
}

async function submitReply(s: any) {
  const reply = replyDraft.value[s.id]?.trim(); if (!reply) return
  // Delete photos from storage first if any exist
  if (s.photo_urls?.length && !s.photos_deleted) {
    await supabase.storage.from('checkin-photos').remove(s.photo_urls)
  }
  await supabase.from('checkin_submissions').update({ trainer_reply: reply, is_read: true }).eq('id', s.id)
  s.trainer_reply = reply; s.photo_urls = []; s.photos_deleted = true; s.is_read = true
  delete signedPhotoUrls.value[s.id]
  delete replyDraft.value[s.id]
}

async function markRead(s: any) {
  if (s.is_read) return
  await supabase.from('checkin_submissions').update({ is_read: true }).eq('id', s.id)
  s.is_read = true
}

onMounted(async () => {
  const trainerId = auth.user?.id; if (!trainerId) return

  const [tmplRes, assignRes, subRes, clientRes] = await Promise.all([
    supabase.from('checkin_templates').select('*').eq('trainer_id', trainerId).order('created_at', { ascending: false }),
    supabase.from('checkin_assignments').select('*').eq('trainer_id', trainerId).order('created_at', { ascending: false }),
    supabase.from('checkin_submissions').select('*').eq('trainer_id', trainerId).order('submitted_at', { ascending: false }),
    supabase.from('trainer_assignments').select('client_id').eq('trainer_id', trainerId).eq('is_active', true),
  ])

  templates.value   = tmplRes.data   ?? []
  assignments.value = assignRes.data ?? []
  submissions.value = subRes.data    ?? []
  await generateSignedUrls(submissions.value)

  const clientIds = (clientRes.data ?? []).map(r => r.client_id)
  if (clientIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', clientIds)
    clients.value = profiles ?? []
  }

  // Mark opened submissions as read
  for (const s of submissions.value) { if (!s.is_read && s.trainer_reply === null) markRead(s) }

  loading.value = false
})
</script>

<style scoped>
.page { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.page-title { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: #F0F0F0; letter-spacing: 0.05em; }
.page-sub   { font-size: 0.75rem; color: #636366; margin-top: 0.2rem; display: flex; align-items: center; gap: 0.5rem; }
.unread-badge { background: #4A9EFF; color: #fff; font-family: 'Barlow Condensed', sans-serif; font-size: 0.6rem; font-weight: 900; padding: 0.1rem 0.4rem; letter-spacing: 0.08em; }
.loading-state { text-align: center; padding: 4rem; color: #636366; }

.tab-badge { background: #4A9EFF; color: #fff; font-size: 0.58rem; font-weight: 900; padding: 0.1rem 0.35rem; border-radius: 99px; }

.empty-state { padding: 4rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.empty-icon  { font-size: 2.5rem; color: #3A3A3C; }
.empty-title { font-family: 'Barlow Condensed', sans-serif; font-size: 1.1rem; font-weight: 700; color: #636366; }

.submission-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
.submission-card { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.875rem; border-left: 3px solid transparent; }
.submission-card.unread { border-left-color: #4A9EFF; }
.sub-header { display: flex; align-items: center; gap: 0.75rem; }
.sub-client { font-family: 'Barlow Condensed', sans-serif; font-size: 1rem; font-weight: 700; color: #F0F0F0; }
.sub-date   { font-size: 0.72rem; color: #636366; margin-left: auto; }
.new-dot    { width: 7px; height: 7px; background: #4A9EFF; border-radius: 50%; flex-shrink: 0; }
.sub-template { font-size: 0.72rem; color: #636366; text-transform: uppercase; letter-spacing: 0.08em; }
.sub-answers { display: flex; flex-direction: column; gap: 0.4rem; }
.answer-row  { display: flex; gap: 0.75rem; font-size: 0.82rem; }
.answer-label { color: #636366; min-width: 160px; }
.answer-val   { color: #C7C7CC; }
.sub-photos  { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.sub-photos a { cursor: zoom-in; }
.sub-photo   { width: 140px; height: 140px; object-fit: cover; border: 1px solid #3A3A3C; display: block; transition: border-color 0.15s; }
.sub-photos a:hover .sub-photo { border-color: #4A9EFF; }
.photo-warning { font-size: 0.68rem; color: #FFB400; }
.photo-deleted-note { font-size: 0.72rem; color: #636366; display: flex; align-items: center; gap: 0.4rem; }
.reply-box   { background: #1C1C1E; border: 1px solid #252528; border-left: 2px solid #4A9EFF; padding: 0.75rem; }
.reply-label { font-family: 'Barlow Condensed', sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; color: #4A9EFF; margin-bottom: 0.35rem; }
.reply-text  { font-size: 0.82rem; color: #C7C7CC; line-height: 1.5; }
.reply-form  { display: flex; flex-direction: column; gap: 0.5rem; }
.reply-textarea { min-height: 60px; font-size: 0.82rem; }
.reply-btn   { align-self: flex-end; }

.assign-actions { margin-bottom: 0.75rem; }
.td-name  { color: #C7C7CC; font-weight: 500; }
.td-muted { color: #636366; font-size: 0.78rem; }
.td-val   { color: #AEAEB2; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
.td-actions { display: flex; gap: 0.35rem; }
.status-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.15rem 0.4rem; border: 1px solid; }
.status-badge.active   { color: #34C759; border-color: rgba(76,175,80,0.3); background: rgba(76,175,80,0.08); }
.status-badge.inactive { color: #636366; border-color: #3A3A3C; }
.table-wrap { overflow: hidden; }

.panel-body { display: flex; flex-direction: column; gap: 1.25rem; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }

/* Questions builder */
.q-list { display: flex; flex-direction: column; gap: 0.75rem; }
.q-row { background: #1C1C1E; border: 1px solid #252528; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.q-row-top { display: flex; align-items: center; gap: 0.5rem; }
.q-num  { font-family: 'Barlow Condensed', sans-serif; font-size: 0.75rem; font-weight: 900; color: #4A9EFF; width: 16px; flex-shrink: 0; }
.q-type { flex: 1; }
.q-req  { font-size: 0.68rem; color: #636366; display: flex; align-items: center; gap: 0.25rem; white-space: nowrap; cursor: pointer; }
.q-row-actions { display: flex; gap: 0.25rem; }
.add-q-btn { margin-top: 0.5rem; }

.icon-btn { background: none; border: 1px solid #252528; color: #636366; cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; }
.icon-btn:hover:not(:disabled) { color: #AEAEB2; }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.icon-btn.danger:hover { color: #4A9EFF; border-color: #4A9EFF; }
</style>
