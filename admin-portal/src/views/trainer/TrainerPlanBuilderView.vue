<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">PLAN BUILDER</h1>
        <div class="page-sub">Create and assign training programs to your clients</div>
      </div>
      <Button @click="openCreate"><i class="pi pi-plus" /> NEW PLAN</Button>
    </div>

    <!-- Client filter chips -->
    <div class="filters card">
      <div class="filter-chips">
        <button class="chip" :class="{ active: clientFilter === '' }" @click="clientFilter = ''">ALL CLIENTS</button>
        <button v-for="c in clients" :key="c.id" class="chip" :class="{ active: clientFilter === c.id }" @click="clientFilter = clientFilter === c.id ? '' : c.id">
          {{ c.full_name ?? c.id.slice(0, 8) }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading...</div>

    <div v-else class="card table-wrap">
      <DataTable :value="filteredPlans" :paginator="true" :rows="25" removable-sort>
        <Column field="name" header="Plan Name" sortable>
          <template #body="{ data }">
            <span class="td-name">{{ data.name }}</span>
          </template>
        </Column>
        <Column field="exercise_count" header="Exercises" sortable>
          <template #body="{ data }">
            <span class="td-val">{{ data.exercise_count }}</span>
          </template>
        </Column>
        <Column field="client_id" header="Assigned To">
          <template #body="{ data }">
            <span class="td-muted">{{ clientName(data.client_id) }}</span>
          </template>
        </Column>
        <Column field="starts_at" header="Starts">
          <template #body="{ data }">
            <span class="td-muted">{{ data.starts_at ?? '—' }}</span>
          </template>
        </Column>
        <Column field="is_active" header="Status" sortable>
          <template #body="{ data }">
            <span class="status-badge" :class="data.is_active ? 'active' : 'archived'">
              {{ data.is_active ? 'Active' : 'Archived' }}
            </span>
          </template>
        </Column>
        <Column header="">
          <template #body="{ data }">
            <div class="td-actions">
              <Button severity="secondary" size="small" @click="openEdit(data)"><i class="pi pi-pencil" /></Button>
              <Button severity="secondary" size="small" @click="toggleActive(data)">
                <i class="pi" :class="data.is_active ? 'pi-eye-slash' : 'pi-eye'" />
              </Button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Create / Edit Drawer -->
    <Drawer v-model:visible="drawerVisible" position="right" :header="panel === 'create' ? 'NEW PLAN' : 'EDIT PLAN'" :style="{ width: 'min(90vw, 720px)' }">
      <div class="panel-body">
        <div class="field">
          <label class="mf-label">PLAN NAME</label>
          <InputText v-model="form.name" placeholder="e.g. Week 1–4 Strength Block" style="width:100%" />
        </div>
        <div class="field">
          <label class="mf-label">NOTES</label>
          <Textarea v-model="form.notes" :rows="2" placeholder="Program overview…" style="width:100%" />
        </div>

        <!-- Client assignment -->
        <div class="field">
          <label class="mf-label">ASSIGN TO CLIENTS</label>
          <div class="client-picker">
            <div v-for="c in clients" :key="c.id" class="client-pick-row"
              :class="{ selected: form.clientIds.includes(c.id) }"
              @click="toggleClient(c.id)">
              <i class="pi" :class="form.clientIds.includes(c.id) ? 'pi-check-circle' : 'pi-circle'" />
              <span class="pick-name">{{ c.full_name ?? '—' }}</span>
              <span class="pick-sub">{{ c.email }}</span>
            </div>
          </div>
        </div>

        <div class="field">
          <label class="mf-label">START DATE (optional)</label>
          <InputText v-model="form.starts_at" type="date" style="width:100%" />
        </div>

        <!-- Exercise picker -->
        <div class="field">
          <label class="mf-label">ADD EXERCISES</label>
          <IconField class="search-wrap-sm">
            <InputIcon class="pi pi-search" />
            <InputText v-model="exQuery" placeholder="Search by name, muscle…" style="width:100%" />
          </IconField>
          <div class="bp-chips">
            <button class="bp-chip" :class="{ active: exBodyPart === '' }" @click="exBodyPart = ''">All</button>
            <button
              v-for="bp in bodyParts" :key="bp"
              class="bp-chip" :class="{ active: exBodyPart === bp }"
              @click="exBodyPart = exBodyPart === bp ? '' : bp"
            >{{ bp }}</button>
          </div>
          <div class="ex-picker">
            <div v-for="ex in filteredExercises" :key="ex.id" class="ex-pick-row"
              :class="{ selected: isExSelected(ex.id) }" @click="toggleExercise(ex)">
              <i class="pi" :class="isExSelected(ex.id) ? 'pi-check-circle' : 'pi-circle'" />
              <span class="ex-pick-name">{{ ex.name }}</span>
              <span class="ex-pick-bp">{{ ex.body_part.replace('_', ' ') }}</span>
            </div>
          </div>
        </div>

        <!-- Exercise config -->
        <div v-if="form.exercises.length" class="field">
          <label class="mf-label">EXERCISE CONFIGURATION</label>
          <div class="ex-config-list">
            <div v-for="(ex, idx) in form.exercises" :key="ex.exerciseId" class="ex-config-row">
              <div class="ex-config-header">
                <div class="ex-config-info">
                  <span class="ex-config-num">{{ idx + 1 }}</span>
                  <span class="ex-config-name">{{ ex.name }}</span>
                </div>
                <div class="ex-config-actions">
                  <button class="icon-btn" :disabled="idx === 0" @click="moveEx(idx, -1)"><i class="pi pi-arrow-up" /></button>
                  <button class="icon-btn" :disabled="idx === form.exercises.length - 1" @click="moveEx(idx, 1)"><i class="pi pi-arrow-down" /></button>
                  <button class="icon-btn danger" @click="removeEx(idx)"><i class="pi pi-times" /></button>
                </div>
              </div>
              <div class="ex-config-fields">
                <div class="mini-field full-width">
                  <label class="mini-label">SETS &amp; TYPES</label>
                  <ExerciseSetBuilder v-model="ex.set_configs" />
                </div>
                <div class="mini-field"><label class="mini-label">SUPERSET #</label><input v-model.number="ex.superset_group" type="number" min="1" max="10" class="mini-input" placeholder="—" /></div>
              </div>
              <InputText v-model="ex.notes" placeholder="Notes for this exercise…" class="note-input" style="width:100%" />
            </div>
          </div>
        </div>

        <div v-if="saveError" class="field-error">{{ saveError }}</div>
      </div>
      <template #footer>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <Button severity="secondary" @click="drawerVisible = false">Cancel</Button>
          <Button :disabled="!form.name.trim() || !form.clientIds.length || saving" @click="handleSave">
            {{ saving ? 'Saving…' : panel === 'create' ? 'CREATE & ASSIGN' : 'SAVE' }}
          </Button>
        </div>
      </template>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import Fuse from 'fuse.js'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { v4 as uuidv4 } from 'uuid'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Drawer from 'primevue/drawer'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import ExerciseSetBuilder, { type SetConfig } from '@/components/ExerciseSetBuilder.vue'

interface PlanRow { assignment_id: string; template_id: string; name: string; notes: string | null; exercise_count: number; client_id: string; starts_at: string | null; is_active: boolean }
interface ExercConfig { exerciseId: string; name: string; body_part: string; set_configs: SetConfig[]; notes: string | null; superset_group: number | null }

function defaultSets(n = 3): SetConfig[] {
  return Array.from({ length: n }, () => ({ set_type: 'working' as const, target_reps: null }))
}
interface Client { id: string; full_name: string | null; email: string }

const auth    = useAuthStore()
const route   = useRoute()
const loading = ref(true)
const saving  = ref(false)
const saveError = ref('')
const plans   = ref<PlanRow[]>([])
const clients = ref<Client[]>([])
const exercises = ref<{ id: string; name: string; body_part: string }[]>([])
const clientFilter = ref((route.query.client as string) ?? '')
const exQuery    = ref('')
const exBodyPart = ref('')

type ExRow = { id: string; name: string; body_part: string }
let fuseIdx: Fuse<ExRow> | null = null
watch(exercises, (list) => {
  fuseIdx = new Fuse(list, {
    keys: [{ name: 'name', weight: 3 }, { name: 'body_part', weight: 1 }],
    threshold: 0.35, minMatchCharLength: 2,
  })
}, { immediate: true })

const bodyParts = computed(() =>
  [...new Set(exercises.value.map(e => e.body_part).filter(Boolean))].sort()
)
const panel   = ref<'create' | 'edit' | null>(null)
const drawerVisible = ref(false)
const editingTemplateId = ref<string | null>(null)
const form    = reactive({ name: '', notes: '', starts_at: '', clientIds: [] as string[], exercises: [] as ExercConfig[] })

const filteredPlans = computed(() => clientFilter.value ? plans.value.filter(p => p.client_id === clientFilter.value) : plans.value)
const filteredExercises = computed(() => {
  let list: ExRow[] = exercises.value
  if (exBodyPart.value) list = list.filter(e => e.body_part === exBodyPart.value)
  if (!exQuery.value.trim() || !fuseIdx) return list
  const results = fuseIdx.search(exQuery.value, { limit: 80 }).map(r => r.item)
  return exBodyPart.value ? results.filter(e => e.body_part === exBodyPart.value) : results
})

function clientName(id: string) { return clients.value.find(c => c.id === id)?.full_name ?? id.slice(0, 8) }
function isExSelected(id: string) { return form.exercises.some(e => e.exerciseId === id) }

function toggleClient(id: string) {
  const idx = form.clientIds.indexOf(id)
  if (idx === -1) form.clientIds.push(id)
  else form.clientIds.splice(idx, 1)
}

function toggleExercise(ex: { id: string; name: string; body_part: string }) {
  const idx = form.exercises.findIndex(e => e.exerciseId === ex.id)
  if (idx === -1) form.exercises.push({ exerciseId: ex.id, name: ex.name, body_part: ex.body_part, set_configs: defaultSets(3), notes: null, superset_group: null })
  else form.exercises.splice(idx, 1)
}

function moveEx(idx: number, dir: -1 | 1) {
  const arr = form.exercises; const ni = idx + dir
  if (ni >= 0 && ni < arr.length) [arr[idx], arr[ni]] = [arr[ni], arr[idx]]
}
function removeEx(idx: number) { form.exercises.splice(idx, 1) }

async function load() {
  loading.value = true
  const trainerId = auth.user?.id
  if (!trainerId) return

  const [assignRes, exRes] = await Promise.all([
    supabase.from('trainer_assignments').select('client_id').eq('trainer_id', trainerId).eq('is_active', true),
    supabase.from('exercises').select('id, name, body_part').is('created_by', null).order('name'),
  ])

  const clientIds = (assignRes.data ?? []).map(a => a.client_id)
  exercises.value = exRes.data ?? []

  if (clientIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', clientIds)
    clients.value = (profiles ?? []).map(p => ({ ...p, email: '' }))

    // Load trainer plans for these clients
    const { data: tpa } = await supabase
      .from('trainer_plan_assignments')
      .select('id, template_id, client_id, starts_at, is_active')
      .eq('trainer_id', trainerId)
      .in('client_id', clientIds)
      .order('assigned_at', { ascending: false })

    if (tpa?.length) {
      const tmplIds = [...new Set(tpa.map(r => r.template_id))]
      const { data: tmpls } = await supabase.from('workout_templates').select('id, name, notes').in('id', tmplIds)
      const { data: exCounts } = await supabase.from('template_exercises').select('template_id').in('template_id', tmplIds)
      const countMap: Record<string, number> = {}
      for (const r of exCounts ?? []) countMap[r.template_id] = (countMap[r.template_id] ?? 0) + 1
      const tmplMap: Record<string, any> = {}
      for (const t of tmpls ?? []) tmplMap[t.id] = t

      plans.value = tpa.map(r => ({
        assignment_id: r.id, template_id: r.template_id,
        name: tmplMap[r.template_id]?.name ?? '—', notes: tmplMap[r.template_id]?.notes ?? null,
        exercise_count: countMap[r.template_id] ?? 0,
        client_id: r.client_id, starts_at: r.starts_at, is_active: r.is_active,
      }))
    }
  }
  loading.value = false
}

function openCreate() {
  form.name = ''; form.notes = ''; form.starts_at = ''; form.clientIds = []; form.exercises = []
  exQuery.value = ''; editingTemplateId.value = null; saveError.value = ''; panel.value = 'create'
  drawerVisible.value = true
  if (clientFilter.value) form.clientIds = [clientFilter.value]
}

async function openEdit(p: PlanRow) {
  editingTemplateId.value = p.template_id
  form.name = p.name; form.notes = p.notes ?? ''; form.starts_at = p.starts_at ?? ''; saveError.value = ''
  // All clients sharing this template
  const { data: tpa } = await supabase.from('trainer_plan_assignments').select('client_id').eq('template_id', p.template_id).eq('trainer_id', auth.user!.id)
  form.clientIds = (tpa ?? []).map(r => r.client_id)
  const { data: exData } = await supabase.from('template_exercises').select('exercise_id, position, target_sets, target_reps, notes, superset_group, set_configs').eq('template_id', p.template_id).order('position')
  form.exercises = (exData ?? []).map(r => {
    const ex = exercises.value.find(e => e.id === r.exercise_id)
    const set_configs: SetConfig[] = r.set_configs ?? defaultSets(r.target_sets ?? 3).map(s => ({ ...s, target_reps: r.target_reps ?? null }))
    return { exerciseId: r.exercise_id, name: ex?.name ?? r.exercise_id.slice(0, 8), body_part: ex?.body_part ?? '', set_configs, notes: r.notes ?? null, superset_group: r.superset_group ?? null }
  })
  exQuery.value = ''; panel.value = 'edit'; drawerVisible.value = true
}

async function handleSave() {
  saving.value = true; saveError.value = ''
  const trainerId = auth.user?.id
  if (!trainerId) { saving.value = false; return }
  const now = new Date().toISOString()

  if (panel.value === 'create') {
    const tmplId = uuidv4()
    const { error } = await supabase.from('workout_templates').insert({
      id: tmplId, owner_id: trainerId, assigned_by: trainerId,
      name: form.name.trim(), notes: form.notes.trim() || null,
      visibility: 'private', is_public: false, folder_name: null,
    })
    if (error) { saveError.value = error.message; saving.value = false; return }
    if (form.exercises.length) {
      await supabase.from('template_exercises').insert(form.exercises.map((ex, i) => ({
        id: uuidv4(), template_id: tmplId, exercise_id: ex.exerciseId, position: i,
        set_configs: ex.set_configs.length ? ex.set_configs : defaultSets(3),
        target_sets: ex.set_configs.length || 3, target_reps: null,
        notes: ex.notes || null, superset_group: ex.superset_group || null,
        target_rpe: null, updated_at: now,
      })))
    }
    await supabase.from('trainer_plan_assignments').insert(form.clientIds.map(cid => ({
      id: uuidv4(), template_id: tmplId, client_id: cid, trainer_id: trainerId,
      starts_at: form.starts_at || null, is_active: true,
    })))
  } else if (editingTemplateId.value) {
    await supabase.from('workout_templates').update({ name: form.name.trim(), notes: form.notes.trim() || null }).eq('id', editingTemplateId.value)
    await supabase.from('template_exercises').delete().eq('template_id', editingTemplateId.value)
    if (form.exercises.length) {
      await supabase.from('template_exercises').insert(form.exercises.map((ex, i) => ({
        id: uuidv4(), template_id: editingTemplateId.value!, exercise_id: ex.exerciseId, position: i,
        set_configs: ex.set_configs.length ? ex.set_configs : defaultSets(3),
        target_sets: ex.set_configs.length || 3, target_reps: null,
        notes: ex.notes || null, superset_group: ex.superset_group || null,
        target_rpe: null, updated_at: now,
      })))
    }
    // Sync client assignments
    const { data: existing } = await supabase.from('trainer_plan_assignments').select('id, client_id').eq('template_id', editingTemplateId.value).eq('trainer_id', trainerId)
    const existingIds = (existing ?? []).map(r => r.client_id)
    const toAdd = form.clientIds.filter(id => !existingIds.includes(id))
    const toRemove = (existing ?? []).filter(r => !form.clientIds.includes(r.client_id)).map(r => r.id)
    if (toAdd.length) await supabase.from('trainer_plan_assignments').insert(toAdd.map(cid => ({ id: uuidv4(), template_id: editingTemplateId.value!, client_id: cid, trainer_id: trainerId, starts_at: form.starts_at || null, is_active: true })))
    if (toRemove.length) await supabase.from('trainer_plan_assignments').delete().in('id', toRemove)
  }

  saving.value = false; drawerVisible.value = false; await load()
}

async function toggleActive(p: PlanRow) {
  await supabase.from('trainer_plan_assignments').update({ is_active: !p.is_active }).eq('id', p.assignment_id)
  p.is_active = !p.is_active
}

onMounted(load)
</script>

<style scoped>

.filters { padding: 0.875rem; margin-bottom: 1rem; }
.filter-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chip { background: var(--surface); border: 1px solid var(--border); color: var(--muted); font-family: 'Barlow Condensed', sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.2rem 0.65rem; cursor: pointer; transition: all 0.15s; }
.chip.active { background: rgba(74,158,255,0.1); border-color: var(--accent); color: var(--accent); }

.table-wrap { overflow: hidden; }
.td-name  { color: #C7C7CC; font-weight: 500; }
.td-muted { color: var(--muted); font-size: 0.78rem; }
.td-val   { color: #AEAEB2; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
.td-actions { display: flex; gap: 0.35rem; }

.status-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.15rem 0.4rem; border: 1px solid; }
.status-badge.active   { color: #34C759; border-color: rgba(76,175,80,0.3); background: rgba(76,175,80,0.08); }
.status-badge.archived { color: var(--muted); border-color: var(--border); }

.panel-body { display: flex; flex-direction: column; gap: 1.25rem; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field-error { font-size: 0.78rem; color: var(--accent); }

.client-picker { border: 1px solid var(--surface); max-height: 140px; overflow-y: auto; background: var(--bg); }
.client-pick-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid var(--bg); }
.client-pick-row:hover { background: #1E1E22; }
.client-pick-row.selected { background: rgba(74,158,255,0.06); }
.client-pick-row i { font-size: 0.85rem; color: var(--muted); }
.client-pick-row.selected i { color: var(--accent); }
.pick-name { flex: 1; font-size: 0.82rem; color: #C7C7CC; }
.pick-sub  { font-size: 0.65rem; color: var(--muted); }

.search-wrap-sm { margin-bottom: 0.4rem; }
.bp-chips { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.35rem; }
.bp-chip { background: var(--surface); border: 1px solid var(--border); color: var(--muted); font-family: 'Barlow Condensed', sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em; padding: 0.15rem 0.5rem; cursor: pointer; text-transform: capitalize; transition: all 0.12s; }
.bp-chip.active { background: rgba(74,158,255,0.1); border-color: var(--accent); color: var(--accent); }
.ex-picker { border: 1px solid var(--surface); max-height: 200px; overflow-y: auto; background: var(--bg); }
.ex-pick-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.75rem; cursor: pointer; border-bottom: 1px solid var(--bg); }
.ex-pick-row:hover { background: #1E1E22; }
.ex-pick-row.selected { background: rgba(74,158,255,0.06); }
.ex-pick-row i { font-size: 0.85rem; color: var(--muted); }
.ex-pick-row.selected i { color: var(--accent); }
.ex-pick-name { flex: 1; font-size: 0.82rem; color: #C7C7CC; }
.ex-pick-bp { font-size: 0.62rem; color: var(--muted); }

.ex-config-list { display: flex; flex-direction: column; gap: 0.5rem; }
.ex-config-row { background: var(--bg); border: 1px solid var(--surface); padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.ex-config-header { display: flex; align-items: center; justify-content: space-between; }
.ex-config-info { display: flex; align-items: center; gap: 0.5rem; flex: 1; }
.ex-config-num  { font-family: 'Barlow Condensed', sans-serif; font-size: 0.75rem; font-weight: 900; color: var(--accent); width: 18px; }
.ex-config-name { font-size: 0.82rem; color: #C7C7CC; font-weight: 500; }
.ex-config-actions { display: flex; gap: 0.25rem; }
.ex-config-fields { display: flex; gap: 0.75rem; }
.note-input { font-size: 0.78rem; }
.mini-field { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
.mini-field.full-width { flex: none; width: 100%; }
.mini-label { font-family: 'Barlow Condensed', sans-serif; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.1em; color: var(--muted); }
.mini-input { background: var(--surface); border: 1px solid var(--border); color: #EBEBEB; font-family: 'DM Sans', sans-serif; font-size: 0.82rem; padding: 0.3rem 0.4rem; width: 100%; box-sizing: border-box; }
.icon-btn { background: none; border: 1px solid var(--surface); color: var(--muted); cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; }
.icon-btn:hover:not(:disabled) { color: #AEAEB2; border-color: var(--border); }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.icon-btn.danger:hover { color: var(--accent); border-color: var(--accent); }
</style>
