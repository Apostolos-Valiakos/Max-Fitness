<template>
  <div class="view">
    <header class="view-header">
      <button class="back-btn" @click="router.back()"><i class="pi pi-arrow-left" /></button>
      <h1 class="view-title">CHECK-IN FORMS</h1>
    </header>

    <!-- Per-client forms list -->
    <section class="section">
      <h2 class="section-title">MY CLIENTS</h2>
      <div v-if="!clients.length" class="empty-state">No clients assigned yet.</div>

      <div v-for="c in clients" :key="c.id" class="client-block">
        <div class="client-name">{{ c.full_name ?? c.email }}</div>

        <!-- Existing active form -->
        <div v-if="activeForms[c.id]" class="form-preview">
          <div class="fp-title">{{ activeForms[c.id].title }}</div>
          <div class="fp-meta">{{ activeForms[c.id].questions.length }} questions</div>
          <div class="fp-actions">
            <button class="fp-btn" @click="editForm(c.id, activeForms[c.id])">Edit</button>
            <button class="fp-btn danger" @click="deactivateForm(activeForms[c.id].id)">Deactivate</button>
          </div>
        </div>

        <button v-else class="create-form-btn" @click="startCreate(c.id)">
          <i class="pi pi-plus" /> Create check-in form
        </button>

        <!-- Recent responses -->
        <div v-if="responses[c.id]?.length" class="responses-block">
          <div class="resp-header">Recent responses</div>
          <div v-for="r in responses[c.id].slice(0, 3)" :key="r.id" class="resp-item" @click="viewResponse(r)">
            <span class="resp-date">{{ format(new Date(r.submitted_at), 'MMM d, HH:mm') }}</span>
            <i class="pi pi-chevron-right resp-arrow" />
          </div>
        </div>
      </div>
    </section>

    <!-- Create/Edit dialog -->
    <Dialog v-model:visible="showFormDialog" modal :header="editingFormId ? 'EDIT FORM' : 'NEW CHECK-IN FORM'" :style="{ width: '95vw', maxWidth: '480px' }" class="mf-dialog">
      <div class="dialog-body">
        <div class="field"><label>FORM TITLE</label>
          <input v-model="formTitle" class="d-input" placeholder="e.g. Weekly Check-in" />
        </div>

        <div class="questions-section">
          <div class="q-header">QUESTIONS</div>
          <div v-for="(q, i) in formQuestions" :key="i" class="q-row">
            <div class="q-num">{{ i + 1 }}</div>
            <div class="q-fields">
              <input v-model="q.text" class="d-input q-text" placeholder="Question text…" />
              <select v-model="q.type" class="d-select">
                <option value="text">Text answer</option>
                <option value="scale">Scale 1–10</option>
                <option value="yesno">Yes / No</option>
              </select>
            </div>
            <button class="q-del" @click="formQuestions.splice(i, 1)">✕</button>
          </div>
          <button class="add-q-btn" @click="formQuestions.push({ text: '', type: 'text' })">
            <i class="pi pi-plus" /> Add question
          </button>
        </div>

        <div class="dialog-actions">
          <button class="dialog-btn cancel" @click="showFormDialog = false">Cancel</button>
          <button class="dialog-btn finish" :disabled="!formTitle || !formQuestions.length" @click="saveForm">
            {{ editingFormId ? 'Save' : 'Create' }}
          </button>
        </div>
      </div>
    </Dialog>

    <!-- View response dialog -->
    <Dialog v-model:visible="showResponseDialog" modal header="CHECK-IN RESPONSE" :style="{ width: '95vw', maxWidth: '480px' }" class="mf-dialog">
      <div v-if="viewingResponse" class="resp-body">
        <div class="resp-date-large">{{ format(new Date(viewingResponse.submitted_at), 'EEEE, MMM d yyyy · HH:mm') }}</div>
        <div v-for="(q, i) in viewingResponseQuestions" :key="i" class="resp-qa">
          <div class="resp-q">{{ i + 1 }}. {{ q.text }}</div>
          <div class="resp-a">{{ viewingResponse.answers[i] ?? '—' }}</div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Dialog from 'primevue/dialog'
import { supabase }    from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { format } from 'date-fns'

interface Question { text: string; type: 'text' | 'scale' | 'yesno' }
interface ClientInfo { id: string; full_name: string | null; email: string | null }
interface CheckinForm { id: string; title: string; questions: Question[]; client_id: string }
interface CheckinResponse { id: string; form_id: string; answers: Record<number, any>; submitted_at: string }

const router = useRouter()
const auth   = useAuthStore()

const clients      = ref<ClientInfo[]>([])
const activeForms  = ref<Record<string, CheckinForm>>({})   // client_id → form
const responses    = ref<Record<string, CheckinResponse[]>>({}) // client_id → responses

const showFormDialog = ref(false)
const editingFormId  = ref<string | null>(null)
const targetClientId = ref<string | null>(null)
const formTitle      = ref('')
const formQuestions  = reactive<Question[]>([])

const showResponseDialog   = ref(false)
const viewingResponse      = ref<CheckinResponse | null>(null)
const viewingResponseQuestions = ref<Question[]>([])

onMounted(async () => {
  if (!auth.user?.id) return
  // Fetch assigned clients
  const { data: assignments } = await supabase
    .from('trainer_assignments')
    .select('client_id, profiles!trainer_assignments_client_id_fkey(id, full_name)')
    .eq('trainer_id', auth.user.id)
    .eq('is_active', true)

  clients.value = (assignments ?? []).map((a: any) => ({
    id:        a.profiles.id,
    full_name: a.profiles.full_name,
    email:     null,
  }))

  // Fetch active check-in forms for each client
  for (const c of clients.value) {
    const { data: form } = await supabase
      .from('checkin_forms')
      .select('id, title, questions, client_id')
      .eq('trainer_id', auth.user.id)
      .eq('client_id', c.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (form) activeForms.value[c.id] = form as CheckinForm

    // Fetch recent responses
    if (form) {
      const { data: reps } = await supabase
        .from('checkin_responses')
        .select('id, form_id, answers, submitted_at')
        .eq('form_id', form.id)
        .order('submitted_at', { ascending: false })
        .limit(5)
      responses.value[c.id] = reps ?? []
    }
  }
})

function startCreate(clientId: string) {
  targetClientId.value = clientId
  editingFormId.value  = null
  formTitle.value      = ''
  formQuestions.splice(0, formQuestions.length, { text: '', type: 'text' })
  showFormDialog.value = true
}

function editForm(clientId: string, form: CheckinForm) {
  targetClientId.value = clientId
  editingFormId.value  = form.id
  formTitle.value      = form.title
  formQuestions.splice(0, formQuestions.length, ...form.questions.map(q => ({ ...q })))
  showFormDialog.value = true
}

async function saveForm() {
  if (!auth.user?.id || !targetClientId.value || !formTitle.value) return
  const payload = {
    trainer_id: auth.user.id,
    client_id:  targetClientId.value,
    title:      formTitle.value,
    questions:  formQuestions.filter(q => q.text),
    is_active:  true,
  }
  if (editingFormId.value) {
    await supabase.from('checkin_forms').update(payload).eq('id', editingFormId.value)
    activeForms.value[targetClientId.value] = { ...payload, id: editingFormId.value } as CheckinForm
  } else {
    // Deactivate any existing form first
    await supabase.from('checkin_forms').update({ is_active: false })
      .eq('trainer_id', auth.user.id).eq('client_id', targetClientId.value)
    const { data } = await supabase.from('checkin_forms').insert(payload).select().single()
    if (data) activeForms.value[targetClientId.value] = data as CheckinForm
  }
  showFormDialog.value = false
}

async function deactivateForm(formId: string) {
  await supabase.from('checkin_forms').update({ is_active: false }).eq('id', formId)
  // Remove from activeForms
  for (const [cid, f] of Object.entries(activeForms.value)) {
    if (f.id === formId) delete activeForms.value[cid]
  }
}

function viewResponse(r: CheckinResponse) {
  viewingResponse.value = r
  // Find questions for this form
  for (const f of Object.values(activeForms.value)) {
    if (f.id === r.form_id) { viewingResponseQuestions.value = f.questions; break }
  }
  showResponseDialog.value = true
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap');
.view { padding: 1.5rem 1rem 2rem; color: #F0F0F0; font-family: 'DM Sans',sans-serif; background: #0A0A0A; min-height: 100vh; }
.view-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.back-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 1rem; padding: 0; }
.view-title { font-family: 'Barlow Condensed',sans-serif; font-size: 1.8rem; font-weight: 900; }
.section { margin-bottom: 2rem; }
.section-title { font-family: 'Barlow Condensed',sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.2em; color: #555; margin-bottom: 0.75rem; }
.empty-state { color: #444; font-size: 0.85rem; text-align: center; padding: 2rem 0; }

.client-block { background: #111; border: 1px solid #1A1A1A; padding: 1rem; margin-bottom: 0.75rem; }
.client-name { font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 800; color: #F0F0F0; margin-bottom: 0.65rem; }

.form-preview { background: #1A1A1A; border: 1px solid #2A2A2A; padding: 0.65rem 0.75rem; }
.fp-title { font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; font-weight: 700; color: #F0F0F0; }
.fp-meta { font-size: 0.7rem; color: #555; margin-top: 0.1rem; }
.fp-actions { display: flex; gap: 0.4rem; margin-top: 0.5rem; }
.fp-btn { background: #111; border: 1px solid #2A2A2A; color: #888; font-family: 'Barlow Condensed',sans-serif; font-size: 0.75rem; font-weight: 700; padding: 0.3rem 0.75rem; cursor: pointer; }
.fp-btn.danger { border-color: rgba(255,0,0,0.2); color: #FF4444; }

.create-form-btn { background: none; border: 1px dashed #2A2A2A; color: #555; font-size: 0.8rem; padding: 0.5rem 0.75rem; cursor: pointer; width: 100%; text-align: left; display: flex; align-items: center; gap: 0.5rem; }
.create-form-btn:active { border-color: #FF4D00; color: #FF4D00; }

.responses-block { margin-top: 0.75rem; }
.resp-header { font-family: 'Barlow Condensed',sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.15em; color: #444; margin-bottom: 0.35rem; }
.resp-item { display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #1A1A1A; cursor: pointer; }
.resp-item:last-child { border-bottom: none; }
.resp-date { font-size: 0.72rem; color: #555; }
.resp-arrow { font-size: 0.65rem; color: #333; }

/* Dialog */
.dialog-body { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.25rem; }
.field label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.15em; color: #555; }
.d-input { background: #1A1A1A; border: 1px solid #2A2A2A; color: #F0F0F0; font-size: 0.9rem; padding: 0.55rem 0.65rem; width: 100%; font-family: 'DM Sans',sans-serif; }
.d-input:focus { outline: none; border-color: #FF4D00; }
.d-select { background: #1A1A1A; border: 1px solid #2A2A2A; color: #888; font-size: 0.8rem; padding: 0.4rem 0.5rem; width: 100%; }
.questions-section { display: flex; flex-direction: column; gap: 0.5rem; }
.q-header { font-family: 'Barlow Condensed',sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.15em; color: #555; }
.q-row { display: flex; align-items: flex-start; gap: 0.4rem; }
.q-num { font-family: 'Barlow Condensed',sans-serif; font-size: 0.85rem; color: #555; width: 16px; flex-shrink: 0; padding-top: 0.55rem; }
.q-fields { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
.q-text { margin-bottom: 0; }
.q-del { background: none; border: none; color: #444; cursor: pointer; padding: 0.25rem; font-size: 0.8rem; margin-top: 0.4rem; flex-shrink: 0; }
.q-del:active { color: #FF4D00; }
.add-q-btn { background: none; border: 1px dashed #2A2A2A; color: #555; font-size: 0.78rem; padding: 0.4rem 0.65rem; cursor: pointer; display: flex; align-items: center; gap: 0.35rem; align-self: flex-start; }
.add-q-btn:active { border-color: #FF4D00; color: #FF4D00; }
.dialog-actions { display: flex; gap: 0.5rem; }
.dialog-btn { flex: 1; border: none; font-family: 'Barlow Condensed',sans-serif; font-weight: 700; letter-spacing: 0.1em; font-size: 0.9rem; padding: 0.75rem; cursor: pointer; }
.dialog-btn.cancel { background: #1A1A1A; color: #888; }
.dialog-btn.finish { background: #FF4D00; color: #fff; clip-path: polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%); }
.dialog-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Response view */
.resp-body { display: flex; flex-direction: column; gap: 1rem; }
.resp-date-large { font-size: 0.75rem; color: #555; }
.resp-qa { display: flex; flex-direction: column; gap: 0.25rem; }
.resp-q { font-size: 0.78rem; color: #888; }
.resp-a { font-size: 0.95rem; color: #F0F0F0; padding: 0.5rem 0.65rem; background: #1A1A1A; border: 1px solid #2A2A2A; }

:deep(.mf-dialog .p-dialog) { background: #111 !important; border: 1px solid #2A2A2A !important; border-radius: 0 !important; }
:deep(.mf-dialog .p-dialog-header) { background: #111 !important; color: #F0F0F0 !important; font-family: 'Barlow Condensed',sans-serif !important; font-weight: 800 !important; border-bottom: 1px solid #1A1A1A !important; padding: 1rem 1.25rem !important; }
:deep(.mf-dialog .p-dialog-content) { background: #111 !important; padding: 1.25rem !important; }
</style>
