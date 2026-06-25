<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">GYMS</h1>
        <div class="page-sub">{{ gyms.length }} tenant{{ gyms.length !== 1 ? 's' : '' }}</div>
      </div>
      <Button label="Create Gym" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div v-if="loading" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading…</div>

    <template v-else>
      <DataTable :value="gyms" class="owner-table" :row-hover="true">
        <Column field="name" header="GYM">
          <template #body="{ data }">
            <span class="gym-name">{{ data.name }}</span>
            <div class="gym-slug">{{ data.slug }}</div>
          </template>
        </Column>
        <Column header="PLAN">
          <template #body="{ data }">
            <span class="badge" :class="data.plan">{{ data.plan.toUpperCase() }}</span>
          </template>
        </Column>
        <Column header="STATUS">
          <template #body="{ data }">
            <span class="status-dot" :class="data.subscription_status" />
            <span class="status-label">{{ data.subscription_status }}</span>
          </template>
        </Column>
        <Column header="USERS">
          <template #body="{ data }">
            <span class="kpi-mini">{{ (counts[data.id]?.total ?? 0).toLocaleString() }}</span>
            <span class="sub-counts">
              {{ counts[data.id]?.trainers ?? 0 }}T · {{ counts[data.id]?.clients ?? 0 }}C
            </span>
          </template>
        </Column>
        <Column header="EST. MRR">
          <template #body="{ data }">
            <span class="mrr-val">€{{ planMRR(data.plan).toLocaleString() }}</span>
          </template>
        </Column>
        <Column header="JOIN CODE">
          <template #body="{ data }">
            <span class="join-code">{{ data.join_code }}</span>
          </template>
        </Column>
        <Column header="CREATED">
          <template #body="{ data }">
            <span class="td-muted">{{ fmtDate(data.created_at) }}</span>
          </template>
        </Column>
        <Column header="">
          <template #body="{ data }">
            <div class="action-cell">
              <Button
                label="Manage"
                icon="pi pi-eye"
                size="small"
                severity="secondary"
                @click="manageGym(data)"
              />
              <Button
                v-if="data.subscription_status !== 'suspended'"
                label="Suspend"
                icon="pi pi-ban"
                size="small"
                severity="danger"
                outlined
                @click="setStatus(data, 'suspended')"
              />
              <Button
                v-else
                label="Activate"
                icon="pi pi-check"
                size="small"
                severity="success"
                outlined
                @click="setStatus(data, 'active')"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </template>

    <!-- Create gym dialog -->
    <Dialog v-model:visible="createVisible" header="CREATE GYM" modal :style="{ width: '460px' }">
      <div class="form-grid">
        <div>
          <label class="mf-label">Gym Name</label>
          <InputText v-model="form.name" name="name" @input="syncSlug" placeholder="CrossFit Athens" />
        </div>
        <div>
          <label class="mf-label">Slug (URL-safe)</label>
          <InputText v-model="form.slug" name="slug" placeholder="crossfit-athens" />
        </div>
        <div>
          <label class="mf-label">Join Code</label>
          <InputText v-model="form.join_code" name="join_code" placeholder="ATHXFT" maxlength="16" style="text-transform:uppercase" />
        </div>
        <div>
          <label class="mf-label">Plan</label>
          <Select v-model="form.plan" :options="planOptions" option-label="label" option-value="value" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" outlined @click="createVisible = false" />
        <Button label="Create" icon="pi pi-check" :loading="saving" @click="createGym" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { adminSupabase } from '@/lib/adminSupabase'
import { useAuthStore } from '@/stores/authStore'
import { useOwnerStore } from '@/stores/ownerStore'
import { format } from 'date-fns'

const router = useRouter()
const toast  = useToast()
const auth   = useAuthStore()
const owner  = useOwnerStore()

// ── Plan config ──────────────────────────────────────────────────────────────
const PLAN_MRR: Record<string, number> = { basic: 49, pro: 149, elite: 299 }
function planMRR(plan: string) { return PLAN_MRR[plan] ?? 0 }

const planOptions = [
  { label: 'Basic  — €49/mo',  value: 'basic'  },
  { label: 'Pro    — €149/mo', value: 'pro'    },
  { label: 'Elite  — €299/mo', value: 'elite'  },
]

// ── State ────────────────────────────────────────────────────────────────────
const loading = ref(true)
const saving  = ref(false)
const gyms    = ref<any[]>([])
const counts  = ref<Record<string, { total: number; trainers: number; clients: number }>>({})

// ── Create dialog ────────────────────────────────────────────────────────────
const createVisible = ref(false)
const form = reactive({ name: '', slug: '', join_code: '', plan: 'basic' })

function openCreate() {
  form.name = ''; form.slug = ''; form.join_code = randomCode(); form.plan = 'basic'
  createVisible.value = true
}

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function syncSlug() {
  form.slug = form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ── Load ─────────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  const [gymsRes, profilesRes] = await Promise.all([
    adminSupabase.from('gyms').select('*').order('created_at', { ascending: false }),
    adminSupabase.from('profiles').select('gym_id, role').not('gym_id', 'is', null),
  ])

  gyms.value = gymsRes.data ?? []

  const map: Record<string, { total: number; trainers: number; clients: number }> = {}
  for (const p of profilesRes.data ?? []) {
    const gid = p.gym_id
    if (!map[gid]) map[gid] = { total: 0, trainers: 0, clients: 0 }
    map[gid].total++
    if (p.role === 'trainer') map[gid].trainers++
    else if (p.role === 'user') map[gid].clients++
  }
  counts.value = map
  loading.value = false
}

// ── Create gym ───────────────────────────────────────────────────────────────
async function createGym() {
  if (!form.name.trim() || !form.slug.trim() || !form.join_code.trim()) {
    toast.add({ severity: 'warn', summary: 'Missing fields', detail: 'Name, slug, and join code are required.', life: 3500 })
    return
  }
  saving.value = true
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 14)

  const { error } = await adminSupabase.from('gyms').insert({
    name:                form.name.trim(),
    slug:                form.slug.trim(),
    join_code:           form.join_code.toUpperCase().trim(),
    plan:                form.plan,
    created_by:          auth.user!.id,
    subscription_status: 'trialing',
    trial_ends_at:       trialEnd.toISOString(),
  })
  saving.value = false
  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 })
    return
  }
  toast.add({ severity: 'success', summary: 'Gym created', life: 2500 })
  createVisible.value = false
  await load()
}

// ── Suspend / Activate ───────────────────────────────────────────────────────
async function setStatus(gym: any, status: string) {
  const { error } = await adminSupabase.from('gyms').update({ subscription_status: status }).eq('id', gym.id)
  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 })
    return
  }
  gym.subscription_status = status
  toast.add({ severity: 'success', summary: status === 'suspended' ? 'Gym suspended' : 'Gym activated', life: 2000 })
}

// ── Manage (impersonate) ─────────────────────────────────────────────────────
function manageGym(gym: any) {
  owner.startImpersonating({ id: gym.id, name: gym.name })
  router.push('/dashboard')
}

function fmtDate(iso: string) { return format(new Date(iso), 'MMM d, yyyy') }

onMounted(load)
</script>

<style scoped>
.gym-name { font-family: 'Barlow Condensed', sans-serif; font-size: 1rem; font-weight: 700; color: var(--text); letter-spacing: 0.03em; display: block; }
.gym-slug { font-size: 0.67rem; color: var(--muted); margin-top: 0.1rem; }

.badge { font-family: 'Barlow Condensed', sans-serif; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.15em; padding: 0.15rem 0.5rem; display: inline-block; }
.badge.basic { background: var(--surface); color: var(--muted); }
.badge.pro   { background: rgba(74,158,255,0.1); color: var(--accent); border: 1px solid rgba(74,158,255,0.3); }
.badge.elite { background: rgba(255,180,0,0.1); color: var(--gold); border: 1px solid rgba(255,180,0,0.3); }

.status-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 0.45rem; }
.status-dot.active    { background: #34C759; }
.status-dot.trialing  { background: var(--accent); }
.status-dot.past_due  { background: var(--gold); }
.status-dot.suspended,
.status-dot.canceled  { background: var(--danger); }
.status-label { font-family: 'Barlow Condensed', sans-serif; font-size: 0.72rem; font-weight: 700; color: var(--sub); letter-spacing: 0.08em; }

.kpi-mini   { font-family: 'Barlow Condensed', sans-serif; font-size: 1.05rem; font-weight: 700; color: var(--text); display: block; }
.sub-counts { font-size: 0.67rem; color: var(--muted); }
.mrr-val    { font-family: 'Barlow Condensed', sans-serif; font-size: 1rem; font-weight: 700; color: #34C759; }
.join-code  { font-family: 'Barlow Condensed', sans-serif; font-size: 0.88rem; font-weight: 700; color: var(--sub); letter-spacing: 0.15em; }
.td-muted   { font-size: 0.78rem; color: var(--muted); }

.action-cell { display: flex; gap: 0.4rem; flex-wrap: wrap; }

.form-grid { display: flex; flex-direction: column; gap: 1rem; padding-bottom: 0.5rem; }

.owner-table :deep(.p-datatable-thead > tr > th) { white-space: nowrap; }
</style>
