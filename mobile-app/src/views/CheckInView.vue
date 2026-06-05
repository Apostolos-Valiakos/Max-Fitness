<template>
  <div class="view">
    <header class="view-header">
      <button class="back-btn" @click="activeForm ? (activeForm = null) : router.back()">
        <i class="pi pi-arrow-left" />
      </button>
      <h1 class="view-title">CHECK-INS</h1>
    </header>

    <div v-if="loading" class="empty-state">Loading…</div>

    <!-- ── Pending + History list ─────────────────────────────────────── -->
    <template v-else-if="!activeForm">

      <!-- Pending -->
      <template v-if="pendingAssignments.length > 0">
        <div class="section-label">PENDING</div>
        <div class="assignment-list">
          <div
            v-for="a in pendingAssignments" :key="a.id"
            class="assignment-card pending-card"
            @click="openForm(a)"
          >
            <div class="a-info">
              <div class="a-name">{{ a.template_name }}</div>
              <div class="a-due">Due {{ formatDate(a.next_due_at) }}</div>
            </div>
            <i class="pi pi-chevron-right a-arrow" />
          </div>
        </div>
      </template>
      <div v-else class="no-pending">
        <i class="pi pi-check-circle" /> No pending check-ins
      </div>

      <!-- Past submissions -->
      <template v-if="pastSubmissions.length > 0">
        <div class="section-label" style="margin-top:1.5rem">HISTORY</div>
        <div class="submission-list">
          <div
            v-for="s in pastSubmissions" :key="s.id"
            class="submission-card"
            :class="{ 'has-reply': !!s.trainer_reply, 'no-reply': !s.trainer_reply }"
            @click="toggleSubmission(s.id)"
          >
            <div class="sub-header">
              <div class="sub-name">{{ s.template_name }}</div>
              <div class="sub-date">{{ formatDate(s.submitted_at) }}</div>
              <span v-if="s.trainer_reply" class="reply-badge">Replied</span>
              <span v-else class="pending-badge">Awaiting reply</span>
            </div>

            <!-- Expanded detail -->
            <template v-if="expandedId === s.id">
              <div class="sub-answers">
                <div v-for="(val, qid) in s.answers" :key="qid" class="sub-answer-row">
                  <div class="sub-q">{{ s.questionLabels?.[qid] ?? qid }}</div>
                  <div class="sub-a">{{ formatAnswer(val) }}</div>
                </div>
              </div>

              <!-- Photos (if not yet deleted) -->
              <div v-if="s.photo_urls?.length && !s.photos_deleted" class="sub-photos">
                <img
                  v-for="(url, i) in s.photo_urls" :key="i"
                  :src="url" class="sub-photo" alt="Progress photo"
                />
              </div>
              <div v-if="s.photos_deleted" class="photos-gone">
                <i class="pi pi-info-circle" /> Photos were deleted after your trainer replied.
              </div>

              <!-- Trainer reply -->
              <div v-if="s.trainer_reply" class="trainer-reply">
                <div class="reply-label">TRAINER'S REPLY</div>
                <div class="reply-text">{{ s.trainer_reply }}</div>
                <div class="reply-date" v-if="s.trainer_replied_at">{{ formatDate(s.trainer_replied_at) }}</div>
              </div>
            </template>
          </div>
        </div>
      </template>
    </template>

    <!-- ── Active form ───────────────────────────────────────────────── -->
    <template v-else>
      <div class="form-title">{{ activeForm.template_name }}</div>

      <div v-for="(q, i) in activeForm.questions" :key="q.id" class="question-block">
        <div class="q-label">
          {{ i + 1 }}. {{ q.label }}
          <span v-if="q.required" class="q-required">*</span>
        </div>

        <template v-if="q.type === 'scale'">
          <div class="scale-row">
            <button v-for="n in 10" :key="n" class="scale-btn" :class="{ active: answers[q.id] === n }" @click="answers[q.id] = n">{{ n }}</button>
          </div>
        </template>

        <template v-else-if="q.type === 'adherence'">
          <div class="scale-row">
            <button v-for="n in [0,25,50,75,100]" :key="n" class="scale-btn wide" :class="{ active: answers[q.id] === n }" @click="answers[q.id] = n">{{ n }}%</button>
          </div>
        </template>

        <template v-else-if="q.type === 'yes_no'">
          <div class="yesno-row">
            <button class="yn-btn" :class="{ active: answers[q.id] === true }"  @click="answers[q.id] = true">Yes</button>
            <button class="yn-btn" :class="{ active: answers[q.id] === false }" @click="answers[q.id] = false">No</button>
          </div>
        </template>

        <template v-else-if="q.type === 'weight' || q.type === 'number'">
          <input v-model.number="answers[q.id]" class="text-input" type="number" :step="q.type === 'weight' ? 0.1 : 1" inputmode="decimal" :placeholder="q.type === 'weight' ? 'kg' : '0'" />
        </template>

        <template v-else-if="q.type === 'photo'">
          <div class="photo-area">
            <label class="photo-pick-btn">
              <i class="pi pi-camera" />
              <span>{{ photoFiles[q.id]?.length ? 'Add more' : 'Choose photos' }}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple class="photo-input-hidden" @change="onPhotoChange(q.id, $event)" />
            </label>
            <div class="photo-limit">Up to 5 photos · max 5 MB each</div>
            <div v-if="photoFiles[q.id]?.length" class="photo-previews">
              <div v-for="(f, fi) in photoFiles[q.id]" :key="fi" class="photo-thumb-wrap">
                <img :src="photoPreviewUrls[q.id]?.[fi]" class="photo-thumb" />
                <button class="photo-remove" @click="removePhoto(q.id, fi)"><i class="pi pi-times" /></button>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <textarea v-model="answers[q.id]" class="text-ans" rows="3" placeholder="Your answer…" />
        </template>
      </div>

      <div v-if="submitError" class="error-msg"><i class="pi pi-exclamation-triangle" /> {{ submitError }}</div>
      <div v-if="submitted" class="success-msg"><i class="pi pi-check-circle" /> Submitted! Your trainer has been notified.</div>

      <button v-if="!submitted" class="submit-btn" @click="handleSubmit" :disabled="submitting || !canSubmit">
        <span v-if="submitting"><i class="pi pi-spin pi-spinner" /> {{ uploadProgress || 'Submitting…' }}</span>
        <span v-else>SUBMIT CHECK-IN</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useRouter }    from 'vue-router'
import { v4 as uuidv4 } from 'uuid'
import { supabase }     from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { format }       from 'date-fns'

interface Question {
  id: string
  type: 'weight' | 'scale' | 'adherence' | 'free_text' | 'number' | 'photo' | 'yes_no'
  label: string
  required: boolean
}
interface PendingAssignment {
  id: string; template_id: string; template_name: string
  trainer_id: string; next_due_at: string; questions: Question[]
}
interface PastSubmission {
  id: string; assignment_id: string; template_name: string
  submitted_at: string; answers: Record<string, any>
  photo_urls: string[]; photos_deleted: boolean
  trainer_reply: string | null; trainer_replied_at: string | null
  questionLabels: Record<string, string>
}

const MAX_PHOTOS = 5
const router      = useRouter()
const auth        = useAuthStore()
const loading     = ref(true)
const submitting  = ref(false)
const submitted   = ref(false)
const submitError = ref('')
const uploadProgress = ref('')
const expandedId  = ref<string | null>(null)

const pendingAssignments = ref<PendingAssignment[]>([])
const pastSubmissions    = ref<PastSubmission[]>([])
const activeForm         = ref<PendingAssignment | null>(null)
const answers            = reactive<Record<string, any>>({})
const photoFiles         = reactive<Record<string, File[]>>({})
const photoPreviewUrls   = reactive<Record<string, string[]>>({})

const canSubmit = computed(() => {
  if (!activeForm.value) return false
  return activeForm.value.questions.filter(q => q.required).every(q => {
    if (q.type === 'photo') return (photoFiles[q.id]?.length ?? 0) > 0
    return answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== ''
  })
})

function formatDate(iso: string) {
  try { return format(new Date(iso), 'MMM d, yyyy') } catch { return '—' }
}
function formatAnswer(val: any) {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  return String(val)
}
function toggleSubmission(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

onMounted(async () => {
  if (!auth.user?.id) return
  const endOfToday = new Date()
  endOfToday.setUTCHours(23, 59, 59, 999)

  // Load pending assignments
  const { data: pendingData } = await supabase
    .from('checkin_assignments')
    .select('id, template_id, trainer_id, next_due_at, checkin_templates ( name, questions )')
    .eq('client_id', auth.user.id)
    .eq('is_active', true)
    .not('next_due_at', 'is', null)
    .lte('next_due_at', endOfToday.toISOString())

  pendingAssignments.value = (pendingData ?? []).map((row: any) => ({
    id:            row.id,
    template_id:   row.template_id,
    trainer_id:    row.trainer_id,
    next_due_at:   row.next_due_at,
    template_name: row.checkin_templates?.name ?? 'Check-in',
    questions:     (row.checkin_templates?.questions ?? []) as Question[],
  }))

  // Load past submissions with their template questions for label lookup
  const { data: subData } = await supabase
    .from('checkin_submissions')
    .select(`
      id, assignment_id, submitted_at, answers,
      photo_urls, photos_deleted,
      trainer_reply, trainer_replied_at,
      checkin_assignments ( template_id, checkin_templates ( name, questions ) )
    `)
    .eq('client_id', auth.user.id)
    .order('submitted_at', { ascending: false })
    .limit(20)

  pastSubmissions.value = (subData ?? []).map((row: any) => {
    const tmpl = row.checkin_assignments?.checkin_templates
    const questions: Question[] = tmpl?.questions ?? []
    const questionLabels = Object.fromEntries(questions.map(q => [q.id, q.label]))
    return {
      id:               row.id,
      assignment_id:    row.assignment_id,
      template_name:    tmpl?.name ?? 'Check-in',
      submitted_at:     row.submitted_at,
      answers:          row.answers ?? {},
      photo_urls:       row.photo_urls ?? [],
      photos_deleted:   row.photos_deleted,
      trainer_reply:    row.trainer_reply,
      trainer_replied_at: row.trainer_replied_at,
      questionLabels,
    }
  })

  loading.value = false
})

function openForm(a: PendingAssignment) {
  for (const key of Object.keys(answers)) delete answers[key]
  for (const key of Object.keys(photoFiles)) delete photoFiles[key]
  for (const urls of Object.values(photoPreviewUrls)) urls.forEach(URL.revokeObjectURL)
  for (const key of Object.keys(photoPreviewUrls)) delete photoPreviewUrls[key]
  submitted.value = false; submitError.value = ''; activeForm.value = a
}

function onPhotoChange(questionId: string, event: Event) {
  const input = event.target as HTMLInputElement
  const files  = Array.from(input.files ?? [])
  const current = photoFiles[questionId] ?? []
  const combined = [...current, ...files].slice(0, MAX_PHOTOS)
  photoFiles[questionId] = combined
  photoPreviewUrls[questionId] = combined.map(f => URL.createObjectURL(f))
  input.value = ''
}

function removePhoto(questionId: string, index: number) {
  URL.revokeObjectURL(photoPreviewUrls[questionId]?.[index])
  photoFiles[questionId].splice(index, 1)
  photoPreviewUrls[questionId].splice(index, 1)
}

async function handleSubmit() {
  if (!activeForm.value || !auth.user?.id) return
  submitting.value = true; submitError.value = ''

  const submissionId = uuidv4()
  const clientId     = auth.user.id
  const uploadedPaths: string[] = []

  for (const q of activeForm.value.questions.filter(q => q.type === 'photo')) {
    for (let i = 0; i < (photoFiles[q.id] ?? []).length; i++) {
      const file = photoFiles[q.id][i]
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${clientId}/${submissionId}/${q.id}_${i}.${ext}`
      uploadProgress.value = `Uploading photo ${uploadedPaths.length + 1}…`
      const { error: upErr } = await supabase.storage.from('checkin-photos').upload(path, file, { contentType: file.type })
      if (upErr) {
        submitError.value = `Photo upload failed: ${upErr.message}`
        submitting.value = false; uploadProgress.value = ''; return
      }
      uploadedPaths.push(path)
    }
  }
  uploadProgress.value = ''

  const { error } = await supabase.from('checkin_submissions').insert({
    id: submissionId, assignment_id: activeForm.value.id,
    client_id: clientId, trainer_id: activeForm.value.trainer_id,
    answers: { ...answers }, photo_urls: uploadedPaths,
  })

  submitting.value = false
  if (error) {
    if (uploadedPaths.length) await supabase.storage.from('checkin-photos').remove(uploadedPaths)
    submitError.value = error.message; return
  }

  // Add to past submissions immediately
  pastSubmissions.value.unshift({
    id: submissionId, assignment_id: activeForm.value.id,
    template_name: activeForm.value.template_name,
    submitted_at: new Date().toISOString(),
    answers: { ...answers }, photo_urls: uploadedPaths,
    photos_deleted: false, trainer_reply: null, trainer_replied_at: null,
    questionLabels: Object.fromEntries(activeForm.value.questions.map(q => [q.id, q.label])),
  })
  pendingAssignments.value = pendingAssignments.value.filter(a => a.id !== activeForm.value!.id)
  submitted.value = true
  setTimeout(() => { activeForm.value = null; submitted.value = false }, 1800)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap');
.view { padding: 1.5rem 1rem 2rem; color: #F0F0F0; font-family: 'DM Sans',sans-serif; background: #1C1C1E; min-height: 100vh; }
.view-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.back-btn { background: none; border: none; color: #8E8E93; cursor: pointer; font-size: 1rem; padding: 0; }
.view-title { font-family: 'Barlow Condensed',sans-serif; font-size: 1.8rem; font-weight: 900; color: #F0F0F0; }
.section-label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em; color: #8E8E93; margin-bottom: 0.6rem; }

.empty-state { text-align: center; padding: 4rem 1rem; color: #8E8E93; }
.no-pending { font-size: 0.82rem; color: #8E8E93; display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 0; margin-bottom: 0.5rem; }
.no-pending .pi { color: #2A5A2A; }

/* Pending assignments */
.assignment-list { display: flex; flex-direction: column; gap: 0.5rem; }
.assignment-card { display: flex; align-items: center; justify-content: space-between; background: #1C1C1E; border: 1px solid #252528; padding: 1rem 1.25rem; cursor: pointer; transition: border-color 0.15s; }
.pending-card { border-left: 3px solid #4A9EFF; }
.assignment-card:active { border-color: #4A9EFF; }
.a-info { display: flex; flex-direction: column; gap: 0.2rem; }
.a-name { font-family: 'Barlow Condensed',sans-serif; font-size: 1.1rem; font-weight: 800; color: #F0F0F0; }
.a-due  { font-size: 0.72rem; color: #4A9EFF; }
.a-arrow { color: #8E8E93; font-size: 0.8rem; }

/* Past submissions */
.submission-list { display: flex; flex-direction: column; gap: 0.5rem; }
.submission-card { background: #1C1C1E; border: 1px solid #252528; padding: 1rem 1.25rem; cursor: pointer; transition: border-color 0.15s; }
.submission-card.has-reply { border-left: 3px solid #2EAF52; }
.submission-card.no-reply  { border-left: 3px solid #3A3A3C; }
.submission-card:active { border-color: #636366; }
.sub-header { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.sub-name { font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 800; color: #C7C7CC; flex: 1; }
.sub-date { font-size: 0.68rem; color: #636366; }
.reply-badge   { font-family: 'Barlow Condensed',sans-serif; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.12em; color: #2EAF52; background: rgba(0,166,81,0.1); border: 1px solid rgba(0,166,81,0.3); padding: 0.1rem 0.35rem; }
.pending-badge { font-family: 'Barlow Condensed',sans-serif; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.12em; color: #636366; background: #252528; border: 1px solid #3A3A3C; padding: 0.1rem 0.35rem; }

.sub-answers { margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem; border-top: 1px solid #252528; padding-top: 0.75rem; }
.sub-answer-row { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.8rem; }
.sub-q { color: #636366; flex: 1; }
.sub-a { color: #C7C7CC; font-weight: 500; text-align: right; }

.sub-photos { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.75rem; }
.sub-photo  { width: 72px; height: 72px; object-fit: cover; border: 1px solid #3A3A3C; }
.photos-gone { font-size: 0.72rem; color: #8E8E93; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.35rem; }

.trainer-reply { margin-top: 0.875rem; background: rgba(0,166,81,0.06); border: 1px solid rgba(0,166,81,0.2); border-left: 3px solid #2EAF52; padding: 0.75rem; }
.reply-label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.2em; color: #2EAF52; margin-bottom: 0.4rem; }
.reply-text  { font-size: 0.85rem; color: #C7C7CC; line-height: 1.5; white-space: pre-wrap; }
.reply-date  { font-size: 0.65rem; color: #8E8E93; margin-top: 0.35rem; }

/* Form */
.form-title { font-family: 'Barlow Condensed',sans-serif; font-size: 1.4rem; font-weight: 900; color: #F0F0F0; margin-bottom: 1.5rem; }
.question-block { margin-bottom: 1.5rem; }
.q-label { font-size: 0.88rem; color: #C7C7CC; margin-bottom: 0.65rem; line-height: 1.4; }
.q-required { color: #4A9EFF; margin-left: 0.15rem; }
.scale-row { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.scale-btn { background: #252528; border: 1px solid #3A3A3C; color: #636366; font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; font-weight: 700; width: 36px; height: 36px; cursor: pointer; transition: all 0.1s; }
.scale-btn.wide { width: auto; padding: 0 0.75rem; }
.scale-btn.active { background: rgba(74,158,255,0.1); border-color: #4A9EFF; color: #4A9EFF; }
.yesno-row { display: flex; gap: 0.5rem; }
.yn-btn { background: #252528; border: 1px solid #3A3A3C; color: #636366; font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; font-weight: 700; padding: 0.45rem 1.5rem; cursor: pointer; transition: all 0.1s; }
.yn-btn.active { background: rgba(74,158,255,0.1); border-color: #4A9EFF; color: #4A9EFF; }
.text-input { width: 100%; background: #1C1C1E; border: 1px solid #3A3A3C; color: #F0F0F0; font-family: 'DM Sans',sans-serif; font-size: 1rem; padding: 0.65rem 0.75rem; box-sizing: border-box; }
.text-input:focus { outline: none; border-color: #4A9EFF; }
.text-ans { width: 100%; background: #1C1C1E; border: 1px solid #3A3A3C; color: #F0F0F0; font-family: 'DM Sans',sans-serif; font-size: 0.9rem; padding: 0.65rem 0.75rem; resize: vertical; box-sizing: border-box; }
.text-ans:focus { outline: none; border-color: #4A9EFF; }
.photo-area { display: flex; flex-direction: column; gap: 0.75rem; }
.photo-pick-btn { display: inline-flex; align-items: center; gap: 0.5rem; background: #252528; border: 1px dashed #3A3A3C; color: #AEAEB2; font-size: 0.85rem; padding: 0.75rem 1rem; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
.photo-pick-btn:active { border-color: #4A9EFF; color: #4A9EFF; }
.photo-input-hidden { display: none; }
.photo-limit { font-size: 0.68rem; color: #8E8E93; }
.photo-previews { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.photo-thumb-wrap { position: relative; width: 80px; height: 80px; }
.photo-thumb { width: 80px; height: 80px; object-fit: cover; border: 1px solid #3A3A3C; display: block; }
.photo-remove { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.75); border: none; color: #fff; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; cursor: pointer; border-radius: 50%; }
.error-msg { display: flex; align-items: center; gap: 0.5rem; color: #4A9EFF; font-size: 0.82rem; background: rgba(74,158,255,0.08); border: 1px solid rgba(74,158,255,0.2); padding: 0.6rem 0.75rem; margin-bottom: 1rem; }
.success-msg { display: flex; align-items: center; gap: 0.5rem; color: #34C759; font-size: 0.88rem; margin-bottom: 1rem; }
.submit-btn { width: 100%; background: #4A9EFF; border: none; color: #fff; font-family: 'Barlow Condensed',sans-serif; font-weight: 800; letter-spacing: 0.1em; font-size: 1rem; padding: 0.9rem; cursor: pointer; clip-path: polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%); margin-top: 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
