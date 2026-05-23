<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">USERS</h1>
      <div class="page-sub">{{ filtered.length }} of {{ users.length }} users</div>
    </div>

    <!-- Filters -->
    <div class="filters card">
      <div class="search-wrap">
        <i class="pi pi-search search-icon" />
        <input v-model="query" class="search-input" placeholder="Search by name or email..." />
      </div>
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
      <div v-if="loading" class="loading"><i class="pi pi-spin pi-spinner" /> Loading users...</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Tier</th>
            <th>Joined</th>
            <th>Last Sign-in</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in paginated" :key="u.id">
            <td>
              <div class="user-cell">
                <img v-if="u.avatar_url" :src="u.avatar_url" class="user-avatar-img" />
                <div v-else class="user-avatar">{{ initials(u) }}</div>
                <div>
                  <div class="user-name">{{ u.full_name ?? '—' }}</div>
                  <div class="user-email">{{ u.email }}</div>
                </div>
              </div>
            </td>
            <td>
              <select class="inline-select" :value="u.role" @change="updateRole(u, ($event.target as HTMLSelectElement).value as any)" :disabled="u.id === selfId">
                <option value="user">user</option>
                <option value="trainer">trainer</option>
                <option value="admin">admin</option>
              </select>
            </td>
            <td>
              <select class="inline-select" :value="u.tier" @change="updateTier(u, ($event.target as HTMLSelectElement).value as any)" :disabled="u.id === selfId">
                <option value="free">free</option>
                <option value="paid">paid</option>
                <option value="ultra">ultra</option>
              </select>
            </td>
            <td class="td-muted">{{ fmtDate(u.created_at) }}</td>
            <td class="td-muted">{{ u.last_sign_in_at ? fmtDate(u.last_sign_in_at) : '—' }}</td>
            <td class="td-actions">
              <router-link :to="`/clients/${u.id}`" class="btn btn-ghost btn-sm" title="View progress">
                <i class="pi pi-chart-line" />
              </router-link>
              <button v-if="u.id !== selfId" class="btn btn-danger btn-sm" @click="confirmDelete(u)">
                <i class="pi pi-trash" />
              </button>
            </td>
          </tr>
          <tr v-if="filtered.length === 0"><td colspan="6" class="td-empty">No users found</td></tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="pagination" v-if="totalPages > 1">
        <button class="btn btn-ghost btn-sm" :disabled="page === 1" @click="page--">
          <i class="pi pi-chevron-left" />
        </button>
        <span class="page-info">{{ page }} / {{ totalPages }}</span>
        <button class="btn btn-ghost btn-sm" :disabled="page === totalPages" @click="page++">
          <i class="pi pi-chevron-right" />
        </button>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="deleteTarget" class="modal-backdrop" @click.self="deleteTarget = null">
      <div class="modal">
        <div class="modal-title">Delete User?</div>
        <p class="modal-body">This will permanently delete <strong>{{ deleteTarget.email }}</strong> and all their data. This cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-danger" @click="handleDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { adminSupabase, listAuthUsers } from '@/lib/adminSupabase'
import { useAuthStore } from '@/stores/authStore'
import { format } from 'date-fns'
import type { UserRow, UserRole, UserTier } from '@/lib/database.types'

const auth    = useAuthStore()
const selfId  = computed(() => auth.user?.id)
const loading = ref(true)
const users   = ref<UserRow[]>([])

const query      = ref('')
const roleFilter = ref('all')
const tierFilter = ref('all')
const page       = ref(1)
const PAGE_SIZE  = 25

const deleteTarget = ref<UserRow | null>(null)

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

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paginated  = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

function initials(u: UserRow) {
  const name = u.full_name ?? u.email ?? '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}
function fmtDate(iso: string) { return format(new Date(iso), 'MMM d, yyyy') }

onMounted(async () => {
  loading.value = true
  const [authUsers, { data: profiles }] = await Promise.all([
    listAuthUsers(),
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
  ])
  const emailMap      = Object.fromEntries(authUsers.map(u => [u.id, u]))
  users.value = (profiles ?? []).map(p => ({
    ...p,
    email:           emailMap[p.id]?.email ?? '',
    last_sign_in_at: emailMap[p.id]?.last_sign_in_at ?? null,
  }))
  loading.value = false
})

async function updateRole(u: UserRow, role: UserRole) {
  await supabase.from('profiles').update({ role }).eq('id', u.id)
  u.role = role
}
async function updateTier(u: UserRow, tier: UserTier) {
  await supabase.from('profiles').update({ tier }).eq('id', u.id)
  u.tier = tier
}

function confirmDelete(u: UserRow) { deleteTarget.value = u }
async function handleDelete() {
  if (!deleteTarget.value) return
  await adminSupabase.auth.admin.deleteUser(deleteTarget.value.id)
  users.value = users.value.filter(u => u.id !== deleteTarget.value!.id)
  deleteTarget.value = null
}
</script>

<style scoped>
.page { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1.5rem; }
.page-title { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: #F0F0F0; letter-spacing: 0.05em; }
.page-sub   { font-size: 0.75rem; color: #444; }

.filters { padding: 1rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
.search-wrap { position: relative; }
.search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #444; font-size: 0.85rem; }
.search-input { width: 100%; background: #1A1A1A; border: 1px solid #2A2A2A; color: #F0F0F0; font-family: 'DM Sans', sans-serif; font-size: 0.88rem; padding: 0.55rem 0.75rem 0.55rem 2.25rem; }
.search-input:focus { outline: none; border-color: #FF4D00; }
.filter-chips { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
.chip { background: #1A1A1A; border: 1px solid #2A2A2A; color: #555; font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.2rem 0.65rem; cursor: pointer; transition: all 0.15s; }
.chip.active { background: rgba(255,77,0,0.1); border-color: #FF4D00; color: #FF4D00; }
.divider { width: 1px; height: 18px; background: #2A2A2A; margin: 0 0.25rem; }

.table-wrap { overflow: hidden; }
.loading { padding: 2rem; text-align: center; color: #444; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }

.user-cell  { display: flex; align-items: center; gap: 0.75rem; }
.user-avatar { width: 30px; height: 30px; background: #1A1A1A; border: 1px solid #2A2A2A; display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed', sans-serif; font-size: 0.72rem; font-weight: 800; color: #666; flex-shrink: 0; }
.user-avatar-img { width: 30px; height: 30px; object-fit: cover; flex-shrink: 0; }
.user-name  { font-size: 0.85rem; color: #C0C0C0; font-weight: 500; }
.user-email { font-size: 0.72rem; color: #555; margin-top: 0.05rem; }
.td-muted   { color: #444; font-size: 0.78rem; }
.td-empty   { color: #333; font-size: 0.8rem; text-align: center; padding: 2rem; }

.inline-select { background: #1A1A1A; border: 1px solid #2A2A2A; color: #888; font-family: 'DM Sans', sans-serif; font-size: 0.78rem; padding: 0.2rem 0.4rem; cursor: pointer; }
.inline-select:focus { outline: none; border-color: #FF4D00; }
.inline-select:disabled { opacity: 0.4; cursor: not-allowed; }

.td-actions { display: flex; gap: 0.35rem; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; padding: 1rem; border-top: 1px solid #1A1A1A; }
.page-info  { font-size: 0.78rem; color: #555; }

/* Modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: #111; border: 1px solid #2A2A2A; padding: 1.5rem; width: 360px; }
.modal-title  { font-family: 'Barlow Condensed', sans-serif; font-size: 1.2rem; font-weight: 800; color: #F0F0F0; margin-bottom: 0.75rem; }
.modal-body   { font-size: 0.85rem; color: #888; line-height: 1.5; margin-bottom: 1.5rem; }
.modal-body strong { color: #F0F0F0; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
</style>
