<template>
  <div class="view">
    <header class="view-header">
      <button class="back-btn" @click="router.back()"><i class="pi pi-arrow-left" /></button>
      <h1 class="view-title">CHECK-IN</h1>
    </header>

    <div v-if="loading" class="empty-state">Loading…</div>

    <div v-else-if="!form" class="empty-state">
      <i class="pi pi-clipboard empty-icon" />
      <p>No active check-in forms from your trainer.</p>
    </div>

    <template v-else>
      <div class="form-title">{{ form.title }}</div>

      <div v-for="(q, i) in form.questions" :key="i" class="question-block">
        <div class="q-label">{{ i + 1 }}. {{ q.text }}</div>

        <!-- Scale 1–10 -->
        <template v-if="q.type === 'scale'">
          <div class="scale-row">
            <button
              v-for="n in 10" :key="n"
              class="scale-btn"
              :class="{ active: answers[i] === n }"
              @click="answers[i] = n"
            >{{ n }}</button>
          </div>
        </template>

        <!-- Yes/No -->
        <template v-else-if="q.type === 'yesno'">
          <div class="yesno-row">
            <button class="yn-btn" :class="{ active: answers[i] === 'yes' }" @click="answers[i] = 'yes'">Yes</button>
            <button class="yn-btn" :class="{ active: answers[i] === 'no' }"  @click="answers[i] = 'no'">No</button>
          </div>
        </template>

        <!-- Text -->
        <template v-else>
          <textarea v-model="answers[i]" class="text-ans" rows="3" placeholder="Your answer…" />
        </template>
      </div>

      <button class="submit-btn" @click="handleSubmit" :disabled="submitting">
        {{ submitting ? 'Submitting…' : 'SUBMIT CHECK-IN' }}
      </button>

      <div v-if="submitted" class="success-msg">
        <i class="pi pi-check-circle" /> Submitted! Your trainer has been notified.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter }   from 'vue-router'
import { supabase }    from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface CheckinQuestion { text: string; type: 'text' | 'scale' | 'yesno' }
interface CheckinForm { id: string; title: string; questions: CheckinQuestion[] }

const router    = useRouter()
const auth      = useAuthStore()
const loading   = ref(true)
const submitting = ref(false)
const submitted  = ref(false)
const form      = ref<CheckinForm | null>(null)
const answers   = ref<(string | number | null)[]>([])

onMounted(async () => {
  if (!auth.user?.id) return
  const { data } = await supabase
    .from('checkin_forms')
    .select('id, title, questions')
    .eq('client_id', auth.user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data) {
    form.value    = data as CheckinForm
    answers.value = new Array(data.questions.length).fill(null)
  }
  loading.value = false
})

async function handleSubmit() {
  if (!form.value || !auth.user?.id) return
  submitting.value = true
  const answersMap: Record<number, any> = {}
  answers.value.forEach((a, i) => { answersMap[i] = a })
  await supabase.from('checkin_responses').insert({
    form_id:    form.value.id,
    client_id:  auth.user.id,
    answers:    answersMap,
  })
  submitting.value = false
  submitted.value  = true
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap');
.view { padding: 1.5rem 1rem 2rem; color: #F0F0F0; font-family: 'DM Sans',sans-serif; background: #0A0A0A; min-height: 100vh; }
.view-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.back-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 1rem; padding: 0; }
.view-title { font-family: 'Barlow Condensed',sans-serif; font-size: 1.8rem; font-weight: 900; color: #F0F0F0; }
.form-title { font-family: 'Barlow Condensed',sans-serif; font-size: 1.3rem; font-weight: 800; color: #F0F0F0; margin-bottom: 1.5rem; }
.question-block { margin-bottom: 1.5rem; }
.q-label { font-size: 0.88rem; color: #CCC; margin-bottom: 0.65rem; line-height: 1.4; }
.scale-row { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.scale-btn { background: #1A1A1A; border: 1px solid #2A2A2A; color: #555; font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; font-weight: 700; width: 36px; height: 36px; cursor: pointer; }
.scale-btn.active { background: rgba(255,77,0,0.1); border-color: #FF4D00; color: #FF4D00; }
.yesno-row { display: flex; gap: 0.5rem; }
.yn-btn { background: #1A1A1A; border: 1px solid #2A2A2A; color: #555; font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; font-weight: 700; padding: 0.45rem 1.5rem; cursor: pointer; }
.yn-btn.active { background: rgba(255,77,0,0.1); border-color: #FF4D00; color: #FF4D00; }
.text-ans { width: 100%; background: #111; border: 1px solid #2A2A2A; color: #F0F0F0; font-family: 'DM Sans',sans-serif; font-size: 0.9rem; padding: 0.65rem 0.75rem; resize: vertical; }
.text-ans:focus { outline: none; border-color: #FF4D00; }
.submit-btn { width: 100%; background: #FF4D00; border: none; color: #fff; font-family: 'Barlow Condensed',sans-serif; font-weight: 800; letter-spacing: 0.1em; font-size: 1rem; padding: 0.9rem; cursor: pointer; clip-path: polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%); margin-top: 1rem; }
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.success-msg { display: flex; align-items: center; gap: 0.5rem; color: #00C851; font-size: 0.88rem; margin-top: 1rem; }
.empty-state { text-align: center; padding: 4rem 1rem; color: #444; }
.empty-icon { font-size: 3rem; color: #2A2A2A; display: block; margin-bottom: 1rem; }
</style>
