<template>
  <div class="view">
    <div class="admin-header">
      <div class="admin-title">ADMIN PANEL</div>
      <div class="admin-sub">Manage users and trainer assignments</div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'users' }" @click="tab = 'users'">Users</button>
      <button class="tab" :class="{ active: tab === 'assignments' }" @click="tab = 'assignments'; loadAssignments()">Assignments</button>
    </div>

    <!-- ── USERS TAB ────────────────────────────────────────────── -->
    <div v-if="tab === 'users'" class="tab-body">
      <div class="search-row">
        <input v-model="userSearch" class="search-input" placeholder="Search by name…" />
        <button class="refresh-btn" @click="loadUsers"><i class="pi pi-refresh" /></button>
      </div>

      <div v-if="usersLoading" class="loading-msg">Loading…</div>
      <div v-else-if="!filteredUsers.length" class="empty-msg">No users found.</div>

      <div v-else class="user-list">
        <div v-for="u in filteredUsers" :key="u.id" class="user-row">
          <div class="user-info">
            <div class="user-name">{{ u.full_name || '(no name)' }}</div>
            <div class="user-id">{{ u.id.slice(0, 8) }}…</div>
          </div>
          <div class="user-controls">
            <select
              class="role-select"
              :value="u.role"
              @change="updateRole(u, ($event.target as HTMLSelectElement).value as Profile['role'])"
            >
              <option value="user">user</option>
              <option value="trainer">trainer</option>
              <option value="admin">admin</option>
            </select>
            <select
              class="tier-select"
              :value="u.tier"
              @change="updateTier(u, ($event.target as HTMLSelectElement).value as Profile['tier'])"
            >
              <option value="free">free</option>
              <option value="paid">paid</option>
              <option value="ultra">ultra</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- ── ASSIGNMENTS TAB ─────────────────────────────────────── -->
    <div v-if="tab === 'assignments'" class="tab-body">

      <!-- Add assignment form -->
      <div class="add-card">
        <div class="add-card-title">NEW ASSIGNMENT</div>
        <div class="field-row">
          <label class="field-label">Trainer</label>
          <select v-model="newTrainerId" class="field-select">
            <option value="">— select trainer —</option>
            <option
              v-for="u in trainers"
              :key="u.id"
              :value="u.id"
            >{{ u.full_name || u.id.slice(0, 8) }} ({{ u.role }})</option>
          </select>
        </div>
        <div class="field-row">
          <label class="field-label">Client</label>
          <select v-model="newClientId" class="field-select">
            <option value="">— select client —</option>
            <option
              v-for="u in ultraUsers"
              :key="u.id"
              :value="u.id"
            >{{ u.full_name || u.id.slice(0, 8) }}</option>
          </select>
        </div>
        <div v-if="addError" class="add-error">{{ addError }}</div>
        <button
          class="add-btn"
          :disabled="!newTrainerId || !newClientId || addLoading"
          @click="createAssignment"
        >
          {{ addLoading ? 'Saving…' : '+ CREATE ASSIGNMENT' }}
        </button>
      </div>

      <div class="section-label">ACTIVE ASSIGNMENTS</div>

      <div v-if="assignmentsLoading" class="loading-msg">Loading…</div>
      <div v-else-if="!activeAssignments.length" class="empty-msg">No active assignments.</div>

      <div v-else class="assignment-list">
        <div v-for="a in activeAssignments" :key="a.id" class="assignment-row">
          <div class="assignment-info">
            <div class="assignment-names">
              <span class="a-trainer">{{ a.trainer_name }}</span>
              <i class="pi pi-arrow-right a-arrow" />
              <span class="a-client">{{ a.client_name }}</span>
            </div>
            <div class="assignment-meta">Since {{ formatDate(a.assigned_at) }}</div>
          </div>
          <button class="deactivate-btn" @click="deactivate(a.id)">Remove</button>
        </div>
      </div>

      <div v-if="inactiveAssignments.length" class="section-label" style="margin-top: 1.5rem">
        INACTIVE
      </div>
      <div v-if="inactiveAssignments.length" class="assignment-list">
        <div v-for="a in inactiveAssignments" :key="a.id" class="assignment-row inactive">
          <div class="assignment-info">
            <div class="assignment-names">
              <span class="a-trainer">{{ a.trainer_name }}</span>
              <i class="pi pi-arrow-right a-arrow" />
              <span class="a-client">{{ a.client_name }}</span>
            </div>
          </div>
          <button class="reactivate-btn" @click="reactivate(a.id)">Restore</button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <Transition name="toast-fade">
      <div v-if="toast" class="admin-toast" :class="toast.type">{{ toast.msg }}</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/stores/authStore'

type AdminUser = {
  id: string
  full_name: string | null
  role: Profile['role']
  tier: Profile['tier']
}

type Assignment = {
  id: string
  trainer_id: string
  trainer_name: string
  client_id: string
  client_name: string
  assigned_at: string
  is_active: boolean
}

const tab = ref<'users' | 'assignments'>('users')

// ── Users ──────────────────────────────────────────────────────────────────
const users        = ref<AdminUser[]>([])
const usersLoading = ref(false)
const userSearch   = ref('')

const filteredUsers = computed(() => {
  const q = userSearch.value.toLowerCase()
  return q
    ? users.value.filter(u => u.full_name?.toLowerCase().includes(q))
    : users.value
})

const trainers  = computed(() => users.value.filter(u => u.role === 'trainer' || u.role === 'admin'))
const ultraUsers = computed(() => users.value.filter(u => u.tier === 'ultra'))

async function loadUsers() {
  usersLoading.value = true
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, tier')
    .order('full_name')
  if (error) { showToast('Failed to load users', 'error'); usersLoading.value = false; return }
  users.value = (data ?? []) as AdminUser[]
  usersLoading.value = false
}

async function updateRole(u: AdminUser, newRole: Profile['role']) {
  const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', u.id)
  if (error) { showToast('Failed to update role', 'error'); return }
  u.role = newRole
  showToast(`${u.full_name || 'User'} → ${newRole}`, 'ok')
}

async function updateTier(u: AdminUser, newTier: Profile['tier']) {
  const { error } = await supabase.from('profiles').update({ tier: newTier }).eq('id', u.id)
  if (error) { showToast('Failed to update tier', 'error'); return }
  u.tier = newTier
  showToast(`${u.full_name || 'User'} → ${newTier}`, 'ok')
}

// ── Assignments ────────────────────────────────────────────────────────────
const assignments        = ref<Assignment[]>([])
const assignmentsLoading = ref(false)
const newTrainerId       = ref('')
const newClientId        = ref('')
const addError           = ref('')
const addLoading         = ref(false)

const activeAssignments   = computed(() => assignments.value.filter(a => a.is_active))
const inactiveAssignments = computed(() => assignments.value.filter(a => !a.is_active))

async function loadAssignments() {
  assignmentsLoading.value = true
  const { data, error } = await supabase
    .from('trainer_assignments')
    .select(`
      id, is_active, assigned_at,
      trainer:profiles!trainer_assignments_trainer_id_fkey(id, full_name),
      client:profiles!trainer_assignments_client_id_fkey(id, full_name)
    `)
    .order('assigned_at', { ascending: false })

  if (error) { showToast('Failed to load assignments', 'error'); assignmentsLoading.value = false; return }

  assignments.value = (data ?? []).map((a: any) => ({
    id:           a.id,
    trainer_id:   a.trainer.id,
    trainer_name: a.trainer.full_name || a.trainer.id.slice(0, 8),
    client_id:    a.client.id,
    client_name:  a.client.full_name || a.client.id.slice(0, 8),
    assigned_at:  a.assigned_at,
    is_active:    a.is_active,
  }))
  assignmentsLoading.value = false
}

async function createAssignment() {
  if (!newTrainerId.value || !newClientId.value) return
  addError.value   = ''
  addLoading.value = true
  const { error } = await supabase
    .from('trainer_assignments')
    .upsert(
      { trainer_id: newTrainerId.value, client_id: newClientId.value, is_active: true },
      { onConflict: 'trainer_id,client_id' }
    )
  addLoading.value = false
  if (error) {
    addError.value = error.message.includes('tier=ultra')
      ? 'Client must have ultra tier first.'
      : error.message.includes('role=trainer')
      ? 'Trainer must have trainer or admin role first.'
      : error.message
    return
  }
  newTrainerId.value = ''
  newClientId.value  = ''
  showToast('Assignment created', 'ok')
  await loadAssignments()
}

async function deactivate(id: string) {
  const { error } = await supabase.from('trainer_assignments').update({ is_active: false }).eq('id', id)
  if (error) { showToast('Failed', 'error'); return }
  const a = assignments.value.find(a => a.id === id)
  if (a) a.is_active = false
  showToast('Assignment removed', 'ok')
}

async function reactivate(id: string) {
  const { error } = await supabase.from('trainer_assignments').update({ is_active: true }).eq('id', id)
  if (error) { showToast('Failed', 'error'); return }
  const a = assignments.value.find(a => a.id === id)
  if (a) a.is_active = true
  showToast('Assignment restored', 'ok')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Toast ──────────────────────────────────────────────────────────────────
const toast = ref<{ msg: string; type: 'ok' | 'error' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string, type: 'ok' | 'error') {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { msg, type }
  toastTimer = setTimeout(() => { toast.value = null }, 2500)
}

onMounted(loadUsers)
</script>

<style scoped>

.view {
  background: #1C1C1E; min-height: 100dvh; color: #F0F0F0;
  font-family: 'DM Sans', sans-serif; padding-bottom: 6rem;
}

.admin-header {
  padding: 1.25rem 1.25rem 0.75rem;
  border-bottom: 1px solid #252528;
}
.admin-title {
  font-family: 'Barlow Condensed', sans-serif; font-size: 1.5rem;
  font-weight: 900; letter-spacing: 0.08em; color: #4A9EFF;
}
.admin-sub { font-size: 0.78rem; color: #636366; margin-top: 0.1rem; }

/* Tabs */
.tabs {
  display: flex; border-bottom: 1px solid #252528;
}
.tab {
  flex: 1; background: none; border: none; border-bottom: 2px solid transparent;
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.85rem; font-weight: 700;
  letter-spacing: 0.1em; color: #636366; padding: 0.75rem; cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.tab.active { color: #4A9EFF; border-bottom-color: #4A9EFF; }

.tab-body { padding: 1rem 1.25rem; }

/* Search */
.search-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.search-input {
  flex: 1; background: #1C1C1E; border: 1px solid #3A3A3C; color: #F0F0F0;
  font-family: 'DM Sans', sans-serif; font-size: 0.85rem;
  padding: 0.5rem 0.75rem; outline: none;
}
.search-input::placeholder { color: #636366; }
.search-input:focus { border-color: #4A9EFF; }
.refresh-btn {
  background: #1C1C1E; border: 1px solid #3A3A3C; color: #636366;
  padding: 0.5rem 0.75rem; cursor: pointer; font-size: 0.9rem;
}
.refresh-btn:active { color: #4A9EFF; }

/* User list */
.user-list { display: flex; flex-direction: column; gap: 1px; }
.user-row {
  display: flex; align-items: center; justify-content: space-between;
  background: #1C1C1E; padding: 0.7rem 0.85rem; gap: 0.5rem;
}
.user-info { min-width: 0; flex: 1; }
.user-name { font-size: 0.88rem; font-weight: 500; color: #EBEBEB; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-id   { font-size: 0.65rem; color: #636366; font-family: monospace; }
.user-controls { display: flex; gap: 0.4rem; flex-shrink: 0; }

.role-select, .tier-select {
  background: #252528; border: 1px solid #3A3A3C; color: #EBEBEB;
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.78rem; font-weight: 700;
  letter-spacing: 0.05em; padding: 0.3rem 0.4rem; cursor: pointer;
  appearance: none; -webkit-appearance: none; outline: none;
}
.role-select:focus, .tier-select:focus { border-color: #4A9EFF; }

/* Add card */
.add-card {
  background: #1C1C1E; border: 1px solid #3A3A3C; border-top: 2px solid #4A9EFF;
  padding: 1rem; margin-bottom: 1.25rem;
}
.add-card-title {
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.72rem; font-weight: 700;
  letter-spacing: 0.15em; color: #4A9EFF; margin-bottom: 0.85rem;
}
.field-row { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem; }
.field-label {
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.72rem; font-weight: 700;
  letter-spacing: 0.1em; color: #636366; width: 52px; flex-shrink: 0;
}
.field-select {
  flex: 1; background: #252528; border: 1px solid #3A3A3C; color: #EBEBEB;
  font-family: 'DM Sans', sans-serif; font-size: 0.82rem;
  padding: 0.45rem 0.6rem; outline: none; cursor: pointer;
}
.field-select:focus { border-color: #4A9EFF; }
.add-error { font-size: 0.78rem; color: #FF4444; margin-bottom: 0.6rem; }
.add-btn {
  width: 100%; background: #4A9EFF; border: none; color: #fff;
  font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: 0.88rem;
  letter-spacing: 0.1em; padding: 0.7rem; cursor: pointer; margin-top: 0.25rem;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%);
  transition: background 0.15s;
}
.add-btn:disabled { background: #3A3A3C; color: #636366; cursor: not-allowed; clip-path: none; }
.add-btn:not(:disabled):active { background: #3B8EEF; }

/* Section label */
.section-label {
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700;
  letter-spacing: 0.15em; color: #636366; margin-bottom: 0.5rem;
}

/* Assignment list */
.assignment-list { display: flex; flex-direction: column; gap: 1px; }
.assignment-row {
  display: flex; align-items: center; justify-content: space-between;
  background: #1C1C1E; padding: 0.7rem 0.85rem; gap: 0.75rem;
}
.assignment-row.inactive { opacity: 0.45; }
.assignment-info { flex: 1; min-width: 0; }
.assignment-names {
  display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
  font-size: 0.88rem;
}
.a-trainer { color: #4A9EFF; font-weight: 500; }
.a-arrow   { font-size: 0.65rem; color: #636366; }
.a-client  { color: #EBEBEB; font-weight: 500; }
.assignment-meta { font-size: 0.68rem; color: #636366; margin-top: 0.15rem; }

.deactivate-btn {
  background: none; border: 1px solid rgba(255,68,68,0.3); color: #FF4444;
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.75rem; font-weight: 700;
  letter-spacing: 0.05em; padding: 0.3rem 0.6rem; cursor: pointer; flex-shrink: 0;
}
.deactivate-btn:active { background: rgba(255,68,68,0.08); }

.reactivate-btn {
  background: none; border: 1px solid #3A3A3C; color: #636366;
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.75rem; font-weight: 700;
  letter-spacing: 0.05em; padding: 0.3rem 0.6rem; cursor: pointer; flex-shrink: 0;
}
.reactivate-btn:active { color: #4A9EFF; border-color: #4A9EFF; }

/* Loading / empty */
.loading-msg, .empty-msg { font-size: 0.82rem; color: #636366; padding: 1.5rem 0; text-align: center; }

/* Toast */
.admin-toast {
  position: fixed; bottom: 5.5rem; left: 50%; transform: translateX(-50%);
  background: #252528; border: 1px solid #3A3A3C;
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.85rem; font-weight: 700;
  letter-spacing: 0.05em; color: #EBEBEB;
  padding: 0.55rem 1.25rem; white-space: nowrap; z-index: 300;
}
.admin-toast.ok    { border-color: #34C759; color: #34C759; }
.admin-toast.error { border-color: #FF4444; color: #FF4444; }
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.2s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }
</style>
