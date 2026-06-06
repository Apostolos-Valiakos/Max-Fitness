<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">USERS</h1>
      <div class="page-sub">{{ filtered.length }} of {{ users.length }} users</div>
    </div>

    <!-- Filters -->
    <div class="filters card">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="query" placeholder="Search by name or email..." />
      </IconField>
      <div class="filter-chips">
        <button v-for="r in ['all','user','trainer','admin']" :key="r"
          class="chip" :class="{ active: roleFilter === r }"
          @click="roleFilter = r">{{ r.toUpperCase() }}</button>
        <div class="divider" />
        <button v-for="t in ['all','free','paid','ultra']" :key="t"
          class="chip" :class="{ active: tierFilter === t }"
          @click="tierFilter = t">{{ t.toUpperCase() }}</button>
      </div>
    </div>

    <!-- Table -->
    <div class="card table-wrap">
      <DataTable
        :value="filtered"
        :loading="loading"
        :paginator="true"
        :rows="25"
        :rows-per-page-options="[25, 50, 100]"
        row-hover
        paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
      >
        <Column header="User" style="min-width: 220px">
          <template #body="{ data: u }">
            <div class="user-cell">
              <img v-if="u.avatar_url" :src="u.avatar_url" class="user-avatar-img" />
              <div v-else class="user-avatar">{{ initials(u.full_name ?? u.email) }}</div>
              <div>
                <div class="user-name">{{ u.full_name ?? '—' }}</div>
                <div class="user-email">{{ u.email }}</div>
              </div>
            </div>
          </template>
        </Column>

        <Column header="Role" style="width: 140px">
          <template #body="{ data: u }">
            <Select
              :model-value="u.role"
              :options="ROLE_OPTIONS"
              option-label="label"
              option-value="value"
              :disabled="u.id === selfId"
              @update:model-value="(v) => updateRole(u, v)"
            />
          </template>
        </Column>

        <Column header="Tier" style="width: 140px">
          <template #body="{ data: u }">
            <Select
              :model-value="u.tier"
              :options="TIER_OPTIONS"
              option-label="label"
              option-value="value"
              :disabled="u.id === selfId"
              @update:model-value="(v) => updateTier(u, v)"
            />
          </template>
        </Column>

        <Column header="Joined" field="created_at" style="width: 120px">
          <template #body="{ data: u }">
            <span class="td-muted">{{ fmtDate(u.created_at) }}</span>
          </template>
        </Column>

        <Column header="Last Sign-in" style="width: 130px">
          <template #body="{ data: u }">
            <span class="td-muted">{{ u.last_sign_in_at ? fmtDate(u.last_sign_in_at) : '—' }}</span>
          </template>
        </Column>

        <Column style="width: 80px">
          <template #body="{ data: u }">
            <div class="td-actions">
              <router-link :to="`/clients/${u.id}`">
                <Button icon="pi pi-chart-line" severity="secondary" text size="small" title="View progress" />
              </router-link>
              <Button
                v-if="u.id !== selfId"
                icon="pi pi-trash"
                severity="danger"
                text
                size="small"
                @click="confirmDelete(u)"
              />
            </div>
          </template>
        </Column>

        <template #empty>
          <div class="td-empty">No users found</div>
        </template>
      </DataTable>
    </div>

    <!-- Delete confirm dialog -->
    <Dialog v-model:visible="deleteDialogVisible" modal header="DELETE USER?" :style="{ width: '360px' }">
      <p class="modal-body">
        This will permanently delete <strong>{{ deleteTarget?.email }}</strong> and all their data. This cannot be undone.
      </p>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="deleteDialogVisible = false" />
        <Button label="Delete" severity="danger" @click="handleDelete" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { adminSupabase } from '@/lib/adminSupabase'
import { useAuthStore } from '@/stores/authStore'
import { useAuthUsers } from '@/composables/useAuthUsers'
import { useToast } from 'primevue/usetoast'
import { initials, fmtDate } from '@/lib/utils'
import type { UserRow, UserRole, UserTier } from '@/lib/database.types'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const auth    = useAuthStore()
const selfId  = computed(() => auth.user?.id)
const { authMap, fetchAuthUsers } = useAuthUsers()
const toast   = useToast()
const loading = ref(true)
const users   = ref<UserRow[]>([])

const query      = ref('')
const roleFilter = ref('all')
const tierFilter = ref('all')

const deleteTarget        = ref<UserRow | null>(null)
const deleteDialogVisible = ref(false)

const ROLE_OPTIONS = [
  { label: 'user',    value: 'user' },
  { label: 'trainer', value: 'trainer' },
  { label: 'admin',   value: 'admin' },
]
const TIER_OPTIONS = [
  { label: 'free',  value: 'free' },
  { label: 'paid',  value: 'paid' },
  { label: 'ultra', value: 'ultra' },
]

const filtered = computed(() => {
  let list = users.value
  if (query.value.trim()) {
    const q = query.value.toLowerCase()
    list = list.filter(u => u.email.toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q))
  }
  if (roleFilter.value !== 'all') list = list.filter(u => u.role === roleFilter.value)
  if (tierFilter.value !== 'all') list = list.filter(u => u.tier === tierFilter.value)
  return list
})


onMounted(async () => {
  loading.value = true
  const [, { data: profiles }] = await Promise.all([
    fetchAuthUsers(),
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
  ])
  users.value = (profiles ?? []).map(p => ({
    ...p,
    email:           authMap.value[p.id]?.email ?? '',
    last_sign_in_at: authMap.value[p.id]?.last_sign_in_at ?? null,
  }))
  loading.value = false
})

async function updateRole(u: UserRow, role: UserRole) {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', u.id)
  if (error) { toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 }); return }
  u.role = role
  toast.add({ severity: 'success', summary: 'Role updated', life: 2500 })
}
async function updateTier(u: UserRow, tier: UserTier) {
  const { error } = await supabase.from('profiles').update({ tier }).eq('id', u.id)
  if (error) { toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 }); return }
  u.tier = tier
  toast.add({ severity: 'success', summary: 'Tier updated', life: 2500 })
}

function confirmDelete(u: UserRow) {
  deleteTarget.value = u
  deleteDialogVisible.value = true
}
async function handleDelete() {
  if (!deleteTarget.value) return
  await adminSupabase.auth.admin.deleteUser(deleteTarget.value.id)
  users.value = users.value.filter(u => u.id !== deleteTarget.value!.id)
  deleteDialogVisible.value = false
  deleteTarget.value = null
}
</script>

<style scoped>
.page-header { align-items: baseline; }

.filters { padding: 1rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
.filter-chips { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
.chip { background: var(--surface); border: 1px solid var(--border); color: var(--muted); font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.2rem 0.65rem; cursor: pointer; transition: all 0.15s; }
.chip.active { background: rgba(74,158,255,0.1); border-color: var(--accent); color: var(--accent); }
.divider { width: 1px; height: 18px; background: var(--border); margin: 0 0.25rem; }

.table-wrap { overflow: hidden; }
.user-cell  { display: flex; align-items: center; gap: 0.75rem; }
.user-avatar { width: 30px; height: 30px; background: var(--surface); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed', sans-serif; font-size: 0.72rem; font-weight: 800; color: var(--sub); flex-shrink: 0; }
.user-avatar-img { width: 30px; height: 30px; object-fit: cover; flex-shrink: 0; }
.user-name  { font-size: 0.85rem; color: #C7C7CC; font-weight: 500; }
.user-email { font-size: 0.72rem; color: var(--muted); margin-top: 0.05rem; }
.td-muted   { color: var(--muted); font-size: 0.78rem; }
.td-empty   { color: var(--border); font-size: 0.8rem; text-align: center; padding: 2rem; }
.td-actions { display: flex; gap: 0.25rem; }
.modal-body { font-size: 0.85rem; color: #AEAEB2; line-height: 1.5; }
.modal-body strong { color: var(--text); }
</style>
