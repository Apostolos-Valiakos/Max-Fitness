<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">TRAINERS</h1>
        <div class="page-sub">Trainer assignments and roles</div>
      </div>
      <Button icon="pi pi-plus" label="NEW ASSIGNMENT" @click="showAssignPanel = true" />
    </div>

    <div v-if="loading" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading...</div>

    <div v-else>
      <div v-if="trainers.length === 0" class="empty-state">
        <i class="pi pi-id-card" />
        <p>No trainers yet. Promote a user to the <strong>trainer</strong> or <strong>admin</strong> role in the Users section, then assign them clients here.</p>
      </div>

      <div v-for="trainer in trainers" :key="trainer.id" class="trainer-block card">
        <div class="trainer-header">
          <img v-if="trainer.avatar_url" :src="trainer.avatar_url" class="trainer-avatar-img" />
          <div v-else class="trainer-avatar">{{ initials(trainer.full_name ?? trainer.email) }}</div>
          <div class="trainer-info">
            <div class="trainer-name">{{ trainer.full_name ?? '—' }}</div>
            <div class="trainer-email">{{ trainer.email }}</div>
          </div>
          <span class="badge" :class="trainer.role">{{ trainer.role === 'admin' ? 'ADMIN' : 'TRAINER' }}</span>
          <Button
            v-if="trainer.role === 'trainer'"
            icon="pi pi-user-minus"
            severity="danger"
            text
            size="small"
            title="Remove trainer role"
            @click="demoteTrainer(trainer)"
          />
        </div>

        <div class="clients-section">
          <div class="clients-label">CLIENTS ({{ trainer.clients.length }})</div>
          <div v-if="trainer.clients.length === 0" class="no-clients">No clients assigned</div>
          <DataTable v-else :value="trainer.clients" :paginator="false" size="small">
            <Column header="Client" field="full_name">
              <template #body="{ data: c }">
                <span class="td-name">{{ c.full_name ?? '—' }}</span>
              </template>
            </Column>
            <Column header="Email">
              <template #body="{ data: c }">
                <span class="td-muted">{{ c.email }}</span>
              </template>
            </Column>
            <Column header="Tier" style="width: 90px">
              <template #body="{ data: c }">
                <span class="badge" :class="c.tier">{{ c.tier.toUpperCase() }}</span>
              </template>
            </Column>
            <Column header="Assigned" style="width: 110px">
              <template #body="{ data: c }">
                <span class="td-muted">{{ fmtDate(c.assigned_at) }}</span>
              </template>
            </Column>
            <Column style="width: 50px">
              <template #body="{ data: c }">
                <Button icon="pi pi-times" severity="danger" text size="small"
                  @click="removeAssignment(c.assignment_id, trainer.id, c.id)" />
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
    </div>

    <!-- New assignment drawer -->
    <Drawer v-model:visible="showAssignPanel" position="right" header="NEW ASSIGNMENT" :style="{ width: '380px' }">
      <div class="panel-body">
        <div class="field">
          <label class="mf-label">TRAINER</label>
          <Select
            v-model="assignForm.trainerId"
            :options="trainerOptions"
            option-label="label"
            option-value="value"
            placeholder="Select trainer..."
          />
        </div>
        <div class="field">
          <label class="mf-label">CLIENT (ultra users only)</label>
          <Select
            v-model="assignForm.clientId"
            :options="ultraUserOptions"
            option-label="label"
            option-value="value"
            placeholder="Select client..."
          />
        </div>
        <div v-if="assignError" class="assign-error"><i class="pi pi-exclamation-triangle" /> {{ assignError }}</div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showAssignPanel = false" />
        <Button label="ASSIGN" :disabled="!assignForm.trainerId || !assignForm.clientId" @click="handleAssign" />
      </template>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthUsers } from '@/composables/useAuthUsers'
import { useGymFilter } from '@/composables/useGymFilter'
import { useGymStore } from '@/stores/gymStore'
import { initials, fmtDate } from '@/lib/utils'
import type { TrainerRow, ClientRow } from '@/lib/database.types'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Drawer from 'primevue/drawer'

const { emailMap, fetchAuthUsers } = useAuthUsers()
const { activeGymId } = useGymFilter()
const gymStore  = useGymStore()
const loading   = ref(true)
const trainers        = ref<TrainerRow[]>([])
const allUsers        = ref<any[]>([])
const showAssignPanel = ref(false)
const assignError     = ref('')
const assignForm      = reactive({ trainerId: '', clientId: '' })

const ultraUsers = computed(() => allUsers.value.filter(u => u.tier === 'ultra' && u.role === 'user'))

const trainerOptions  = computed(() => trainers.value.map(t => ({ label: t.full_name ?? t.email, value: t.id })))
const ultraUserOptions = computed(() => ultraUsers.value.map(u => ({ label: `${u.full_name ?? u.email} — ${u.email}`, value: u.id })))


onMounted(async () => { await load() })

async function load() {
  loading.value = true
  let profilesQuery = supabase.from('profiles').select('*')
  if (activeGymId.value) profilesQuery = profilesQuery.eq('gym_id', activeGymId.value)

  let assignQuery = supabase.from('trainer_assignments').select('*').eq('is_active', true)
  if (activeGymId.value) assignQuery = assignQuery.eq('gym_id', activeGymId.value)

  const [, { data: profiles }, { data: assignments }] = await Promise.all([
    fetchAuthUsers(),
    profilesQuery,
    assignQuery,
  ])

  allUsers.value = (profiles ?? []).map(p => ({ ...p, email: emailMap.value[p.id] ?? '' }))

  const trainerProfiles = (profiles ?? []).filter(p => p.role === 'trainer' || p.role === 'admin')
  trainers.value = trainerProfiles.map(tp => {
    const trainerAssignments = (assignments ?? []).filter(a => a.trainer_id === tp.id)
    const clients: ClientRow[] = trainerAssignments.map(a => {
      const cp = (profiles ?? []).find(p => p.id === a.client_id)
      return cp ? { ...cp, email: emailMap.value[cp.id] ?? '', assignment_id: a.id, assigned_at: a.assigned_at } : null
    }).filter(Boolean) as ClientRow[]
    return { ...tp, email: emailMap.value[tp.id] ?? '', clients }
  })
  loading.value = false
}

async function handleAssign() {
  assignError.value = ''

  if (gymStore.gym && activeGymId.value && gymStore.gym.max_clients < 9999) {
    if (gymStore.clientCount >= gymStore.gym.max_clients) {
      assignError.value = `Client limit reached (${gymStore.gym.max_clients} max on your plan). Upgrade to add more clients.`
      return
    }
  }

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
.empty-state p { font-size: 0.85rem; line-height: 1.5; }
.empty-state strong { color: #AEAEB2; }

.trainer-block { margin-bottom: 1rem; overflow: hidden; }
.trainer-header { display: flex; align-items: center; gap: 0.75rem; padding: 1.25rem; border-bottom: 1px solid var(--surface); }
.trainer-avatar { width: 38px; height: 38px; background: rgba(0,136,255,0.1); border: 1px solid rgba(0,136,255,0.2); display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed', sans-serif; font-size: 0.88rem; font-weight: 900; color: #0088FF; flex-shrink: 0; }
.trainer-avatar-img { width: 38px; height: 38px; object-fit: cover; flex-shrink: 0; }
.trainer-info  { flex: 1; }
.trainer-name  { font-family: 'Barlow Condensed', sans-serif; font-size: 1rem; font-weight: 800; color: var(--text); }
.trainer-email { font-size: 0.72rem; color: var(--muted); }

.clients-section { padding: 1rem 1.25rem; }
.clients-label   { font-family: 'Barlow Condensed', sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.2em; color: var(--muted); margin-bottom: 0.75rem; }
.no-clients      { font-size: 0.8rem; color: var(--border); padding: 0.5rem 0; }
.td-name  { color: #C7C7CC; font-weight: 500; }
.td-muted { color: var(--muted); font-size: 0.78rem; }

.panel-body { display: flex; flex-direction: column; gap: 1.25rem; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.assign-error { font-size: 0.8rem; color: var(--accent); background: rgba(74,158,255,0.08); border: 1px solid rgba(74,158,255,0.2); padding: 0.6rem 0.75rem; display: flex; gap: 0.4rem; align-items: center; }
</style>
