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
      <button class="btn btn-primary" @click="openCreateTemplate"><i class="pi pi-plus" /> NEW TEMPLATE</button>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'submissions' }" @click="tab = 'submissions'">
        SUBMISSIONS <span v-if="unreadCount" class="tab-badge">{{ unreadCount }}</span>
      </button>
      <button class="tab" :class="{ active: tab === 'assignments' }" @click="tab = 'assignments'">ASSIGNMENTS</button>
      <button class="tab" :class="{ active: tab === 'templates' }" @click="tab = 'templates'">TEMPLATES</button>
    </div>

    <div v-if="loading" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading...</div>

    <!-- SUBMISSIONS tab -->
    <div v-else-if="tab === 'submissions'">
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
            <textarea v-model="replyDraft[s.id]" class="mf-textarea reply-textarea" rows="2" placeholder="Write a reply to your client…" />
            <button class="btn btn-primary btn-sm reply-btn" :disabled="!replyDraft[s.id]?.trim()" @click="submitReply(s)">
              SEND REPLY
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ASSIGNMENTS tab -->
    <div v-else-if="tab === 'assignments'">
      <div class="assign-actions">
        <button class="btn btn-ghost" @click="openAssign"><i class="pi pi-plus" /> ASSIGN TEMPLATE</button>
      </div>
      <div class="card table-wrap">
        <table class="data-table">
          <thead><tr><th>Client</th><th>Template</th><th>Frequency</th><th>Next Due</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr v-for="a in assignments" :key="a.id">
              <td class="td-name">{{ clientName(a.client_id) }}</td>
              <td class="td-muted">{{ assignments_templateName(a.template_id) }}</td>
              <td class="td-muted">{{ a.frequency }}</td>
              <td class="td-muted">{{ a.next_due_at ? fmtDate(a.next_due_at) : '—' }}</td>
              <td>
                <span class="status-badge" :class="a.is_active ? 'active' : 'inactive'">
                  {{ a.is_active ? 'Active' : 'Paused' }}
                </span>
              </td>
              <td class="td-actions">
                <button class="btn btn-ghost btn-sm" @click="toggleAssignment(a)">
                  <i class="pi" :class="a.is_active ? 'pi-pause' : 'pi-play'" />
                </button>
                <button class="btn btn-danger btn-sm" @click="deleteAssignment(a.id)"><i class="pi pi-trash" /></button>
              </td>
            </tr>
            <tr v-if="!assignments.length"><td colspan="6" class="td-empty">No assignments yet</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TEMPLATES tab -->
    <div v-else-if="tab === 'templates'">
      <div class="card table-wrap">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Questions</th><th>Description</th><th></th></tr></thead>
          <tbody>
            <tr v-for="t in templates" :key="t.id">
              <td class="td-name">{{ t.name }}</td>
              <td class="td-val">{{ t.questions?.length ?? 0 }}</td>
              <td class="td-muted">{{ t.description ?? '—' }}</td>
              <td class="td-actions">
                <button class="btn btn-ghost btn-sm" @click="openEditTemplate(t)"><i class="pi pi-pencil" /></button>
                <button class="btn btn-ghost btn-sm" @click="openAssignFrom(t)"><i class="pi pi-send" /></button>
                <button class="btn btn-danger btn-sm" @click="deleteTemplate(t.id)"><i class="pi pi-trash" /></button>
              </td>
            </tr>
            <tr v-if="!templates.length"><td colspan="4" class="td-empty">No templates yet</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Template create/edit panel -->
    <div v-if="templatePanel" class="overlay" @click.self="templatePanel = null">
      <div class="slide-panel">
        <div class="panel-header">
          <div class="panel-title">{{ editingTemplateId ? 'EDIT TEMPLATE' : 'NEW TEMPLATE' }}</div>
          <button class="panel-close" @click="templatePanel = null"><i class="pi pi-times" /></button>
        </div>
        <div class="panel-body">
          <div class="field"><label class="mf-label">TEMPLATE NAME</label><input v-model="tForm.name" class="mf-input" placeholder="e.g. Weekly Check-in" /></div>
          <div class="field"><label class="mf-label">DESCRIPTION</label><textarea v-model="tForm.description" class="mf-textarea" rows="2" placeholder="What this check-in covers…" /></div>

          <div class="field">
            <label class="mf-label">QUESTIONS</label>
            <div class="q-list">
              <div v-for="(q, qi) in tForm.questions" :key="q.id" class="q-row">
                <div class="q-row-top">
                  <span class="q-num">{{ qi + 1 }}</span>
                  <select v-model="q.type" class="mf-select q-type">
                    <option v-for="qt in QUESTION_TYPES" :key="qt.value" :value="qt.value">{{ qt.label }}</option>
                  </select>
                  <label class="q-req"><input type="checkbox" v-model="q.required" /> Required</label>
                  <div class="q-row-actions">
                    <button class="icon-btn" :disabled="qi === 0" @click="moveQ(qi, -1)"><i class="pi pi-arrow-up" /></button>
                    <button class="icon-btn" :disabled="qi === tForm.questions.length - 1" @click="moveQ(qi, 1)"><i class="pi pi-arrow-down" /></button>
                    <button class="icon-btn danger" @click="removeQ(qi)"><i class="pi pi-times" /></button>
                  </div>
                </div>
                <input v-model="q.label" class="mf-input" :placeholder="`Question label (e.g. ${QUESTION_TYPES.find(t => t.value === q.type)?.placeholder ?? ''})`" />
              </div>
            </div>
            <button class="btn btn-ghost btn-sm add-q-btn" @click="addQuestion"><i class="pi pi-plus" /> ADD QUESTION</button>
          </div>
        </div>
        <div class="panel-footer">
          <button class="btn btn-ghost" @click="templatePanel = null">Cancel</button>
          <button class="btn btn-primary" :disabled="!tForm.name.trim()" @click="saveTemplate">
            {{ editingTemplateId ? 'SAVE' : 'CREATE' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Assign panel -->
    <div v-if="assignPanel" class="overlay" @click.self="assignPanel = false">
      <div class="slide-panel narrow-panel">
        <div class="panel-header">
          <div class="panel-title">ASSIGN CHECK-IN</div>
          <button class="panel-close" @click="assignPanel = false"><i class="pi pi-times" /></button>
        </div>
        <div class="panel-body">
          <div class="field">
            <label class="mf-label">TEMPLATE</label>
            <select v-model="aForm.template_id" class="mf-select">
              <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
          <div class="field">
            <label class="mf-label">CLIENT</label>
            <select v-model="aForm.client_id" class="mf-select">
              <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.full_name ?? c.id.slice(0,8) }}</option>
            </select>
          </div>
          <div class="field">
            <label class="mf-label">FREQUENCY</label>
            <select v-model="aForm.frequency" class="mf-select">
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="manual">Manual only</option>
            </select>
          </div>
          <div class="field" v-if="aForm.frequency !== 'manual'">
            <label class="mf-label">PREFERRED DAY</label>
            <select v-model.number="aForm.day_of_week" class="mf-select">
              <option v-for="(d, i) in DAYS" :key="i" :value="i">{{ d }}</option>
            </select>
          </div>
          <div class="field">
            <label class="mf-label">FIRST DUE DATE</label>
            <input v-model="aForm.next_due_at" type="datetime-local" class="mf-input" />
          </div>
        </div>
        <div class="panel-footer">
          <button class="btn btn-ghost" @click="assignPanel = false">Cancel</button>
          <button class="btn btn-primary" :disabled="!aForm.template_id || !aForm.client_id" @click="saveAssignment">ASSIGN</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { format } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'

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
const tab     = ref<'submissions' | 'assignments' | 'templates'>('submissions')

const templates   = ref<any[]>([])
const assignments = ref<any[]>([])
const submissions = ref<any[]>([])
const clients     = ref<{ id: string; full_name: string | null }[]>([])
const replyDraft  = ref<Record<string, string>>({})
// submission id → signed URLs (1-hour expiry)
const signedPhotoUrls = ref<Record<string, string[]>>({})
const templatePanel  = ref<boolean | null>(false)
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
  addQuestion(); templatePanel.value = true
}
function openEditTemplate(t: any) {
  editingTemplateId.value = t.id; tForm.name = t.name; tForm.description = t.description ?? ''; tForm.questions = JSON.parse(JSON.stringify(t.questions ?? []))
  templatePanel.value = true
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
  templatePanel.value = false
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
.page-sub   { font-size: 0.75rem; color: #444; margin-top: 0.2rem; display: flex; align-items: center; gap: 0.5rem; }
.unread-badge { background: #FF4D00; color: #fff; font-family: 'Barlow Condensed', sans-serif; font-size: 0.6rem; font-weight: 900; padding: 0.1rem 0.4rem; letter-spacing: 0.08em; }
.loading-state { text-align: center; padding: 4rem; color: #444; }

.tabs { display: flex; gap: 0; border-bottom: 1px solid #1A1A1A; margin-bottom: 1.25rem; }
.tab { background: none; border: none; border-bottom: 2px solid transparent; padding: 0.65rem 1.25rem; font-family: 'Barlow Condensed', sans-serif; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.1em; color: #444; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 0.4rem; }
.tab:hover { color: #888; }
.tab.active { color: #FF4D00; border-bottom-color: #FF4D00; }
.tab-badge { background: #FF4D00; color: #fff; font-size: 0.58rem; font-weight: 900; padding: 0.1rem 0.35rem; border-radius: 99px; }

.empty-state { padding: 4rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.empty-icon  { font-size: 2.5rem; color: #2A2A2A; }
.empty-title { font-family: 'Barlow Condensed', sans-serif; font-size: 1.1rem; font-weight: 700; color: #555; }

.submission-list { display: flex; flex-direction: column; gap: 0.75rem; }
.submission-card { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.875rem; border-left: 3px solid transparent; }
.submission-card.unread { border-left-color: #FF4D00; }
.sub-header { display: flex; align-items: center; gap: 0.75rem; }
.sub-client { font-family: 'Barlow Condensed', sans-serif; font-size: 1rem; font-weight: 700; color: #F0F0F0; }
.sub-date   { font-size: 0.72rem; color: #555; margin-left: auto; }
.new-dot    { width: 7px; height: 7px; background: #FF4D00; border-radius: 50%; flex-shrink: 0; }
.sub-template { font-size: 0.72rem; color: #555; text-transform: uppercase; letter-spacing: 0.08em; }
.sub-answers { display: flex; flex-direction: column; gap: 0.4rem; }
.answer-row  { display: flex; gap: 0.75rem; font-size: 0.82rem; }
.answer-label { color: #555; min-width: 160px; }
.answer-val   { color: #C0C0C0; }
.sub-photos  { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.sub-photos a { cursor: zoom-in; }
.sub-photo   { width: 140px; height: 140px; object-fit: cover; border: 1px solid #2A2A2A; display: block; transition: border-color 0.15s; }
.sub-photos a:hover .sub-photo { border-color: #FF4D00; }
.photo-warning { font-size: 0.68rem; color: #FFB400; }
.photo-deleted-note { font-size: 0.72rem; color: #444; display: flex; align-items: center; gap: 0.4rem; }
.reply-box   { background: #0D0D0D; border: 1px solid #1A1A1A; border-left: 2px solid #FF4D00; padding: 0.75rem; }
.reply-label { font-family: 'Barlow Condensed', sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; color: #FF4D00; margin-bottom: 0.35rem; }
.reply-text  { font-size: 0.82rem; color: #C0C0C0; line-height: 1.5; }
.reply-form  { display: flex; flex-direction: column; gap: 0.5rem; }
.reply-textarea { min-height: 60px; font-size: 0.82rem; }
.reply-btn   { align-self: flex-end; }

.assign-actions { margin-bottom: 0.75rem; }
.td-name  { color: #C0C0C0; font-weight: 500; }
.td-muted { color: #555; font-size: 0.78rem; }
.td-val   { color: #888; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
.td-empty { color: #333; font-size: 0.8rem; text-align: center; padding: 2rem; }
.td-actions { display: flex; gap: 0.35rem; }
.status-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.15rem 0.4rem; border: 1px solid; }
.status-badge.active   { color: #4CAF50; border-color: rgba(76,175,80,0.3); background: rgba(76,175,80,0.08); }
.status-badge.inactive { color: #444; border-color: #2A2A2A; }
.table-wrap { overflow: hidden; }

/* Slide panel */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; }
.slide-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 460px; background: #111; border-left: 1px solid #2A2A2A; display: flex; flex-direction: column; z-index: 101; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid #1A1A1A; }
.panel-title  { font-family: 'Barlow Condensed', sans-serif; font-size: 1.1rem; font-weight: 800; color: #F0F0F0; letter-spacing: 0.08em; }
.panel-close  { background: none; border: none; color: #555; cursor: pointer; }
.panel-body   { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.panel-footer { padding: 1rem 1.5rem; border-top: 1px solid #1A1A1A; display: flex; gap: 0.75rem; justify-content: flex-end; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }

/* Questions builder */
.q-list { display: flex; flex-direction: column; gap: 0.75rem; }
.q-row { background: #0D0D0D; border: 1px solid #1A1A1A; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.q-row-top { display: flex; align-items: center; gap: 0.5rem; }
.q-num  { font-family: 'Barlow Condensed', sans-serif; font-size: 0.75rem; font-weight: 900; color: #FF4D00; width: 16px; flex-shrink: 0; }
.q-type { flex: 1; font-size: 0.78rem; padding: 0.25rem 0.4rem; }
.q-req  { font-size: 0.68rem; color: #555; display: flex; align-items: center; gap: 0.25rem; white-space: nowrap; cursor: pointer; }
.q-row-actions { display: flex; gap: 0.25rem; }
.add-q-btn { margin-top: 0.5rem; }

.icon-btn { background: none; border: 1px solid #1A1A1A; color: #444; cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; }
.icon-btn:hover:not(:disabled) { color: #888; }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.icon-btn.danger:hover { color: #FF4D00; border-color: #FF4D00; }
</style>
