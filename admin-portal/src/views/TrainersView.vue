<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">TRAINERS</h1>
        <div class="page-sub">Trainer assignments and roles</div>
      </div>
      <button class="btn btn-primary" @click="showAssignPanel = true">
        <i class="pi pi-plus" /> NEW ASSIGNMENT
      </button>
    </div>

    <div v-if="loading" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading...</div>

    <div v-else>
      <!-- Trainer cards -->
      <div v-if="trainers.length === 0" class="empty-state">
        <i class="pi pi-id-card" />
        <p>No trainers yet. Promote a user to the <strong>trainer</strong> role in the Users section, then assign them clients here.</p>
      </div>

      <div v-for="trainer in trainers" :key="trainer.id" class="trainer-block card">
        <div class="trainer-header">
          <img v-if="trainer.avatar_url" :src="trainer.avatar_url" class="trainer-avatar-img" />
          <div v-else class="trainer-avatar">{{ initials(trainer) }}</div>
          <div class="trainer-info">
            <div class="trainer-name">{{ trainer.full_name ?? '—' }}</div>
            <div class="trainer-email">{{ trainer.email }}</div>
          </div>
          <span class="badge trainer">TRAINER</span>
          <button class="btn btn-danger btn-sm" @click="demoteTrainer(trainer)" title="Remove trainer role">
            <i class="pi pi-user-minus" />
          </button>
        </div>

        <!-- Clients -->
        <div class="clients-section">
          <div class="clients-label">CLIENTS ({{ trainer.clients.length }})</div>
          <div v-if="trainer.clients.length === 0" class="no-clients">No clients assigned</div>
          <table v-else class="data-table">
            <thead><tr><th>Client</th><th>Email</th><th>Tier</th><th>Assigned</th><th></th></tr></thead>
            <tbody>
              <tr v-for="client in trainer.clients" :key="client.id">
                <td class="td-name">{{ client.full_name ?? '—' }}</td>
                <td class="td-muted">{{ client.email }}</td>
                <td><span class="badge" :class="client.tier">{{ client.tier.toUpperCase() }}</span></td>
                <td class="td-muted">{{ fmtDate(client.assigned_at) }}</td>
                <td>
                  <button class="btn btn-danger btn-sm" @click="removeAssignment(client.assignment_id, trainer.id, client.id)">
                    <i class="pi pi-times" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- New assignment panel -->
    <div v-if="showAssignPanel" class="overlay" @click.self="showAssignPanel = false">
      <div class="slide-panel">
        <div class="panel-header">
          <div class="panel-title">NEW ASSIGNMENT</div>
          <button class="panel-close" @click="showAssignPanel = false"><i class="pi pi-times" /></button>
        </div>
        <div class="panel-body">
          <div class="field">
            <label class="mf-label">TRAINER</label>
            <select v-model="assignForm.trainerId" class="mf-select">
              <option value="">Select trainer...</option>
              <option v-for="t in trainers" :key="t.id" :value="t.id">{{ t.full_name ?? t.email }}</option>
            </select>
          </div>
          <div class="field">
            <label class="mf-label">CLIENT (ultra users only)</label>
            <select v-model="assignForm.clientId" class="mf-select">
              <option value="">Select client...</option>
              <option v-for="u in ultraUsers" :key="u.id" :value="u.id">{{ u.full_name ?? u.email }} — {{ u.email }}</option>
            </select>
          </div>
          <div v-if="assignError" class="assign-error"><i class="pi pi-exclamation-triangle" /> {{ assignError }}</div>
        </div>
        <div class="panel-footer">
          <button class="btn btn-ghost" @click="showAssignPanel = false">Cancel</button>
          <button class="btn btn-primary" :disabled="!assignForm.trainerId || !assignForm.clientId" @click="handleAssign">
            ASSIGN
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { supabase } from '@/lib/supabase'
import { listAuthUsers } from '@/lib/adminSupabase'
import { format } from 'date-fns'
import type { TrainerRow, ClientRow } from '@/lib/database.types'

const loading         = ref(true)
const trainers        = ref<TrainerRow[]>([])
const allUsers        = ref<any[]>([])
const showAssignPanel = ref(false)
const assignError     = ref('')
const assignForm      = reactive({ trainerId: '', clientId: '' })

const ultraUsers = computed(() => allUsers.value.filter(u => u.tier === 'ultra' && u.role === 'user'))

function initials(u: { full_name: string | null; email: string }) {
  const name = u.full_name ?? u.email ?? '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}
function fmtDate(iso: string) { return format(new Date(iso), 'MMM d, yyyy') }

onMounted(async () => { await load() })

async function load() {
  loading.value = true
  const [authUsers, { data: profiles }, { data: assignments }] = await Promise.all([
    listAuthUsers(),
    supabase.from('profiles').select('*'),
    supabase.from('trainer_assignments').select('*').eq('is_active', true),
  ])

  const emailMap = Object.fromEntries(authUsers.map(u => [u.id, u.email]))

  allUsers.value = (profiles ?? []).map(p => ({ ...p, email: emailMap[p.id] ?? '' }))

  const trainerProfiles = (profiles ?? []).filter(p => p.role === 'trainer')

  trainers.value = trainerProfiles.map(tp => {
    const trainerAssignments = (assignments ?? []).filter(a => a.trainer_id === tp.id)
    const clients: ClientRow[] = trainerAssignments.map(a => {
      const cp = (profiles ?? []).find(p => p.id === a.client_id)
      return cp ? { ...cp, email: emailMap[cp.id] ?? '', assignment_id: a.id, assigned_at: a.assigned_at } : null
    }).filter(Boolean) as ClientRow[]

    return { ...tp, email: emailMap[tp.id] ?? '', clients }
  })

  loading.value = false
}

async function handleAssign() {
  assignError.value = ''
  const { error } = await supabase
    .from('trainer_assignments')
    .upsert(
      { trainer_id: assignForm.trainerId, client_id: assignForm.clientId, is_active: true },
      { onConflict: 'trainer_id,client_id' }
    )
  if (error) { assignError.value = error.message; return }
  showAssignPanel.value = false
  assignForm.trainerId = ''; assignForm.clientId = ''
  await load()
}

async function removeAssignment(assignmentId: string, trainerId: string, clientId: string) {
  await Promise.all([
    supabase.from('trainer_assignments').delete().eq('id', assignmentId),
    supabase.from('checkin_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('trainer_id', trainerId).eq('client_id', clientId),
    supabase.from('trainer_plan_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('trainer_id', trainerId).eq('client_id', clientId),
  ])
  const trainer = trainers.value.find(t => t.id === trainerId)
  if (trainer) trainer.clients = trainer.clients.filter(c => c.assignment_id !== assignmentId)
}

async function demoteTrainer(trainer: TrainerRow) {
  await supabase.from('profiles').update({ role: 'user' }).eq('id', trainer.id)
  trainers.value = trainers.value.filter(t => t.id !== trainer.id)
}
</script>

<style scoped>
.page { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.page-title  { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: #F0F0F0; letter-spacing: 0.05em; }
.page-sub    { font-size: 0.75rem; color: #444; margin-top: 0.2rem; }

.loading-state { text-align: center; padding: 4rem; color: #444; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
.empty-state   { text-align: center; padding: 4rem 2rem; color: #444; }
.empty-state i { font-size: 2.5rem; color: #2A2A2A; display: block; margin-bottom: 1rem; }
.empty-state p { font-size: 0.85rem; line-height: 1.5; }
.empty-state strong { color: #888; }

.trainer-block { margin-bottom: 1rem; overflow: hidden; }
.trainer-header { display: flex; align-items: center; gap: 0.75rem; padding: 1.25rem; border-bottom: 1px solid #1A1A1A; }
.trainer-avatar { width: 38px; height: 38px; background: rgba(0,136,255,0.1); border: 1px solid rgba(0,136,255,0.2); display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed', sans-serif; font-size: 0.88rem; font-weight: 900; color: #0088FF; flex-shrink: 0; }
.trainer-avatar-img { width: 38px; height: 38px; object-fit: cover; flex-shrink: 0; }
.trainer-info  { flex: 1; }
.trainer-name  { font-family: 'Barlow Condensed', sans-serif; font-size: 1rem; font-weight: 800; color: #F0F0F0; }
.trainer-email { font-size: 0.72rem; color: #555; }

.clients-section { padding: 1rem 1.25rem; }
.clients-label   { font-family: 'Barlow Condensed', sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.2em; color: #444; margin-bottom: 0.75rem; }
.no-clients      { font-size: 0.8rem; color: #333; padding: 0.5rem 0; }
.td-name  { color: #C0C0C0; font-weight: 500; }
.td-muted { color: #555; font-size: 0.78rem; }

/* Slide panel */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; }
.slide-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 380px; background: #111; border-left: 1px solid #2A2A2A; display: flex; flex-direction: column; z-index: 101; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid #1A1A1A; }
.panel-title  { font-family: 'Barlow Condensed', sans-serif; font-size: 1.1rem; font-weight: 800; color: #F0F0F0; letter-spacing: 0.08em; }
.panel-close  { background: none; border: none; color: #555; cursor: pointer; font-size: 0.9rem; }
.panel-close:hover { color: #F0F0F0; }
.panel-body   { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.panel-footer { padding: 1rem 1.5rem; border-top: 1px solid #1A1A1A; display: flex; gap: 0.75rem; justify-content: flex-end; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.assign-error { font-size: 0.8rem; color: #FF4D00; background: rgba(255,77,0,0.08); border: 1px solid rgba(255,77,0,0.2); padding: 0.6rem 0.75rem; display: flex; gap: 0.4rem; align-items: center; }
</style>
