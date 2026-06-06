<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">TEMPLATES</h1>
        <div class="page-sub">Public templates visible to users based on tier</div>
      </div>
      <Button @click="openCreate">
        <i class="pi pi-plus" /> NEW TEMPLATE
      </Button>
    </div>

    <!-- Filters -->
    <div class="filters card">
      <div class="filter-chips">
        <button class="chip" :class="{ active: visFilter === '' && folderFilter === '' }" @click="visFilter = ''; folderFilter = ''">ALL</button>
        <button v-for="v in VISIBILITIES" :key="v.value" class="chip" :class="{ active: visFilter === v.value }" @click="visFilter = visFilter === v.value ? '' : v.value; folderFilter = ''">
          {{ v.label }}
        </button>
        <div v-if="allFolders.length" class="filter-divider" />
        <button v-for="f in allFolders" :key="f" class="chip folder-chip" :class="{ active: folderFilter === f }" @click="folderFilter = folderFilter === f ? '' : f; visFilter = ''">
          <i class="pi pi-folder" /> {{ f }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading...</div>

    <div v-else class="card table-wrap">
      <DataTable :value="filtered" :paginator="true" :rows="25" removable-sort>
        <Column field="name" header="Name" sortable>
          <template #body="{ data }">
            <span class="td-name">{{ data.name }}</span>
          </template>
        </Column>
        <Column field="folder_name" header="Folder">
          <template #body="{ data }">
            <span class="td-muted">{{ data.folder_name ?? '—' }}</span>
          </template>
        </Column>
        <Column field="exercise_count" header="Exercises" sortable>
          <template #body="{ data }">
            <span class="td-val">{{ data.exercise_count }}</span>
          </template>
        </Column>
        <Column field="owner_id" header="Created By">
          <template #body="{ data }">
            <span class="td-muted">{{ creatorName(data.owner_id) }}</span>
          </template>
        </Column>
        <Column field="visibility" header="Visibility" sortable>
          <template #body="{ data }">
            <span class="vis-badge" :class="data.visibility">{{ visLabel(data.visibility) }}</span>
          </template>
        </Column>
        <Column header="">
          <template #body="{ data }">
            <div class="td-actions">
              <Button severity="secondary" size="small" @click="openEdit(data)"><i class="pi pi-pencil" /></Button>
              <Button severity="danger" size="small" @click="deleteTemplate(data.id)"><i class="pi pi-trash" /></Button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Create / Edit Drawer -->
    <Drawer v-model:visible="drawerVisible" position="right" :header="panel === 'create' ? 'NEW TEMPLATE' : 'EDIT TEMPLATE'" :style="{ width: 'min(90vw, 720px)' }">
      <div class="panel-body">
        <!-- Top: metadata row -->
        <div class="meta-grid">
          <div class="field">
            <label class="mf-label">TEMPLATE NAME</label>
            <InputText v-model="form.name" placeholder="e.g. Beginner Full Body" style="width:100%" />
          </div>
          <div class="field">
            <label class="mf-label">VISIBILITY</label>
            <Select v-model="form.visibility" :options="VISIBILITIES_ALL" option-label="label" option-value="value" style="width:100%" />
            <div class="field-hint">{{ visHint(form.visibility) }}</div>
          </div>
          <div class="field">
            <label class="mf-label">FOLDER</label>
            <InputText v-model="form.folder_name" placeholder="e.g. Strength" list="folder-list" style="width:100%" />
            <datalist id="folder-list">
              <option v-for="f in allFolders" :key="f" :value="f" />
            </datalist>
          </div>
        </div>

        <div class="field">
          <label class="mf-label">NOTES (optional)</label>
          <Textarea v-model="form.notes" :rows="2" placeholder="Brief description…" style="width:100%" />
        </div>

        <!-- Main two-column area -->
        <div class="drawer-cols">
          <!-- Left: exercise picker -->
          <div class="picker-col">
            <label class="mf-label">EXERCISES</label>
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
              <div
                v-for="ex in filteredExercises"
                :key="ex.id"
                class="ex-pick-row"
                :class="{ selected: isSelected(ex.id) }"
                @click="toggleExercise(ex)"
              >
                <i class="pi" :class="isSelected(ex.id) ? 'pi-check-circle' : 'pi-circle'" />
                <span class="ex-pick-name">{{ ex.name }}</span>
                <span class="ex-pick-bp">{{ ex.body_part.replace('_', ' ') }}</span>
              </div>
            </div>
          </div>

          <!-- Right: exercise configuration -->
          <div class="config-col">
            <label class="mf-label">
              CONFIGURATION
              <span v-if="form.exercises.length" class="config-count">({{ form.exercises.length }})</span>
            </label>
            <div v-if="!form.exercises.length" class="config-empty">
              Select exercises from the left to configure them here.
            </div>
            <div v-else class="ex-config-list">
              <div v-for="(ex, idx) in form.exercises" :key="ex.exerciseId" class="ex-config-row">
                <div class="ex-config-header">
                  <div class="ex-config-info">
                    <span class="ex-config-num">{{ idx + 1 }}</span>
                    <span class="ex-config-name">{{ ex.name }}</span>
                    <span class="ex-pick-bp">{{ ex.body_part.replace('_', ' ') }}</span>
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
                  <div class="mini-field">
                    <label class="mini-label">SUPERSET #</label>
                    <input v-model.number="ex.superset_group" type="number" min="1" max="10" class="mini-input" placeholder="—" />
                  </div>
                </div>
                <InputText v-model="ex.notes" placeholder="Exercise notes…" class="note-input" style="width:100%;margin-top:0.4rem" />
              </div>
            </div>
          </div>
        </div>

        <div v-if="saveError" class="field-error">{{ saveError }}</div>
      </div>
      <template #footer>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <Button severity="secondary" @click="drawerVisible = false">Cancel</Button>
          <Button :disabled="!form.name.trim() || saving" @click="handleSave">
            {{ saving ? 'Saving…' : panel === 'create' ? 'CREATE' : 'SAVE' }}
          </Button>
        </div>
      </template>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import Fuse from 'fuse.js'
import { v4 as uuidv4 } from 'uuid'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Drawer from 'primevue/drawer'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import ExerciseSetBuilder, { type SetConfig } from '@/components/ExerciseSetBuilder.vue'

interface AdminTemplate {
  id: string; owner_id: string; name: string; notes: string | null
  visibility: string; exercise_count: number; folder_name: string | null
}

interface ExercConfig {
  exerciseId: string; name: string; body_part: string
  set_configs: SetConfig[]
  notes: string | null; superset_group: number | null
}

function defaultSets(n = 3): SetConfig[] {
  return Array.from({ length: n }, () => ({ set_type: 'working' as const, target_reps: null }))
}

const VISIBILITIES = [
  { value: 'private', label: 'Private'      },
  { value: 'free',    label: 'All Users'    },
  { value: 'paid',    label: 'Paid & Ultra' },
  { value: 'ultra',   label: 'Ultra Only'   },
]
const VISIBILITIES_ALL = VISIBILITIES

function visLabel(v: string) { return VISIBILITIES.find(x => x.value === v)?.label ?? v }
function visHint(v: string) {
  if (v === 'private') return 'Only visible to you.'
  if (v === 'free')    return 'Visible to all users regardless of tier.'
  if (v === 'paid')    return 'Visible to Paid and Ultra users.'
  if (v === 'ultra')   return 'Visible to Ultra users only.'
  return ''
}

const loading   = ref(true)
const saving    = ref(false)
const saveError = ref('')
const templates = ref<AdminTemplate[]>([])
const exercises = ref<{ id: string; name: string; body_part: string }[]>([])
const creators  = ref<Record<string, string>>({})
const visFilter = ref('')
const folderFilter = ref('')
const exQuery    = ref('')
const exBodyPart = ref('')

// Fuse index — rebuilt when exercise list loads
type ExerciseRow = { id: string; name: string; body_part: string }
let fuseIndex: Fuse<ExerciseRow> | null = null
watch(exercises, (list) => {
  fuseIndex = new Fuse(list, {
    keys: [{ name: 'name', weight: 3 }, { name: 'body_part', weight: 1 }],
    threshold: 0.35,
    minMatchCharLength: 2,
  })
}, { immediate: true })

// Unique body parts for filter chips
const bodyParts = computed(() => {
  const all = [...new Set(exercises.value.map(e => e.body_part).filter(Boolean))]
  return all.sort()
})
const panel     = ref<'create' | 'edit' | null>(null)
const drawerVisible = ref(false)
const editingId = ref<string | null>(null)
const form      = reactive({
  name: '', notes: '', visibility: 'private', folder_name: '',
  exercises: [] as ExercConfig[],
})

const allFolders = computed(() => {
  const set = new Set(templates.value.map(t => t.folder_name).filter(Boolean) as string[])
  return [...set].sort()
})

const filtered = computed(() => {
  let list = templates.value
  if (visFilter.value) list = list.filter(t => t.visibility === visFilter.value)
  if (folderFilter.value) list = list.filter(t => t.folder_name === folderFilter.value)
  return list
})

const filteredExercises = computed(() => {
  let list: ExerciseRow[] = exercises.value
  if (exBodyPart.value) list = list.filter(e => e.body_part === exBodyPart.value)
  if (!exQuery.value.trim() || !fuseIndex) return list
  const results = fuseIndex.search(exQuery.value, { limit: 80 }).map(r => r.item)
  return exBodyPart.value ? results.filter(e => e.body_part === exBodyPart.value) : results
})

function creatorName(id: string) { return creators.value[id] ?? id.slice(0, 8) }
function isSelected(id: string) { return form.exercises.some(e => e.exerciseId === id) }

function toggleExercise(ex: { id: string; name: string; body_part: string }) {
  const idx = form.exercises.findIndex(e => e.exerciseId === ex.id)
  if (idx === -1) {
    form.exercises.push({ exerciseId: ex.id, name: ex.name, body_part: ex.body_part, set_configs: defaultSets(3), notes: null, superset_group: null })
  } else {
    form.exercises.splice(idx, 1)
  }
}

function moveEx(idx: number, dir: -1 | 1) {
  const arr = form.exercises
  const newIdx = idx + dir
  if (newIdx < 0 || newIdx >= arr.length) return
  ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
}

function removeEx(idx: number) { form.exercises.splice(idx, 1) }

async function load() {
  loading.value = true
  const [templRes, exRes] = await Promise.all([
    supabase.from('workout_templates').select('id, owner_id, name, notes, visibility, folder_name').is('assigned_by', null).order('name'),
    supabase.from('exercises').select('id, name, body_part').is('created_by', null).order('name'),
  ])
  const rawTemplates = templRes.data ?? []
  if (rawTemplates.length) {
    const { data: counts } = await supabase.from('template_exercises').select('template_id').in('template_id', rawTemplates.map(t => t.id))
    const countMap: Record<string, number> = {}
    for (const r of counts ?? []) { countMap[r.template_id] = (countMap[r.template_id] ?? 0) + 1 }
    templates.value = rawTemplates.map(t => ({ ...t, exercise_count: countMap[t.id] ?? 0 }))
  } else {
    templates.value = []
  }
  exercises.value = exRes.data ?? []
  const ownerIds = [...new Set(rawTemplates.map(t => t.owner_id))]
  if (ownerIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ownerIds)
    for (const p of profiles ?? []) creators.value[p.id] = p.full_name ?? p.id.slice(0, 8)
  }
  loading.value = false
}

function openCreate() {
  form.name = ''; form.notes = ''; form.visibility = 'private'; form.folder_name = ''
  form.exercises = []; exQuery.value = ''; editingId.value = null; saveError.value = ''
  panel.value = 'create'; drawerVisible.value = true
}

async function openEdit(t: AdminTemplate) {
  form.name = t.name; form.notes = t.notes ?? ''; form.visibility = t.visibility
  form.folder_name = t.folder_name ?? ''; saveError.value = ''; editingId.value = t.id; exQuery.value = ''
  const { data } = await supabase.from('template_exercises')
    .select('exercise_id, position, target_sets, target_reps, notes, superset_group, set_configs')
    .eq('template_id', t.id).order('position')
  form.exercises = (data ?? []).map(r => {
    const ex = exercises.value.find(e => e.id === r.exercise_id)
    const set_configs: SetConfig[] = r.set_configs ??
      defaultSets(r.target_sets ?? 3).map(s => ({ ...s, target_reps: r.target_reps ?? null }))
    return {
      exerciseId: r.exercise_id, name: ex?.name ?? r.exercise_id.slice(0, 8), body_part: ex?.body_part ?? '',
      set_configs, notes: r.notes ?? null, superset_group: r.superset_group ?? null,
    }
  })
  panel.value = 'edit'; drawerVisible.value = true
}

async function handleSave() {
  saving.value = true; saveError.value = ''
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { saving.value = false; return }
  const now = new Date().toISOString()
  const basePayload = {
    name: form.name.trim(), notes: form.notes.trim() || null,
    visibility: form.visibility, is_public: form.visibility !== 'private',
    folder_name: form.folder_name.trim() || null,
  }
  const exRows = form.exercises.map((ex, i) => ({
    id: uuidv4(), exercise_id: ex.exerciseId, position: i,
    set_configs: ex.set_configs.length ? ex.set_configs : defaultSets(3),
    target_sets: ex.set_configs.length || 3,
    target_reps: null,
    notes: ex.notes || null, superset_group: ex.superset_group || null,
    target_rpe: null, updated_at: now,
  }))

  if (panel.value === 'create') {
    const id = uuidv4()
    const { error } = await supabase.from('workout_templates').insert({ id, owner_id: user.id, assigned_by: null, ...basePayload })
    if (error) { saveError.value = error.message; saving.value = false; return }
    if (exRows.length) {
      await supabase.from('template_exercises').insert(exRows.map(r => ({ ...r, template_id: id })))
    }
  } else if (editingId.value) {
    const { error } = await supabase.from('workout_templates').update(basePayload).eq('id', editingId.value)
    if (error) { saveError.value = error.message; saving.value = false; return }
    await supabase.from('template_exercises').delete().eq('template_id', editingId.value)
    if (exRows.length) {
      await supabase.from('template_exercises').insert(exRows.map(r => ({ ...r, template_id: editingId.value! })))
    }
  }
  saving.value = false; drawerVisible.value = false; await load()
}

async function deleteTemplate(id: string) {
  await supabase.from('workout_templates').delete().eq('id', id)
  templates.value = templates.value.filter(t => t.id !== id)
}

onMounted(load)
</script>

<style scoped>
.filters { padding: 0.875rem; margin-bottom: 1rem; }
.filter-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.filter-divider { width: 1px; height: 16px; background: #3A3A3C; margin: 0 0.2rem; }
.folder-chip i { font-size: 0.6rem; margin-right: 0.2rem; }

.table-wrap { padding: 0; overflow: hidden; }
.td-name  { color: #C7C7CC; font-weight: 500; }
.td-muted { color: #636366; font-size: 0.78rem; }
.td-val   { color: #AEAEB2; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
.td-actions { display: flex; gap: 0.35rem; }

.vis-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.15rem 0.4rem; border: 1px solid; }
.vis-badge.private { color: #636366; border-color: #3A3A3C; }
.vis-badge.free    { color: #34C759; border-color: rgba(76,175,80,0.3); background: rgba(76,175,80,0.08); }
.vis-badge.paid    { color: #4DA6FF; border-color: rgba(77,166,255,0.3); background: rgba(77,166,255,0.08); }
.vis-badge.ultra   { color: #FFD700; border-color: rgba(255,215,0,0.3); background: rgba(255,215,0,0.08); }

.panel-body { display: flex; flex-direction: column; gap: 1.25rem; }

/* Metadata row: 3 columns */
.meta-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 1rem; align-items: start; }

/* Two-column main area */
.drawer-cols { display: grid; grid-template-columns: 260px 1fr; gap: 1.25rem; min-height: 0; }

.picker-col { display: flex; flex-direction: column; gap: 0.5rem; min-height: 0; }
.config-col { display: flex; flex-direction: column; gap: 0.5rem; min-height: 0; overflow-y: auto; }

.config-count { font-family: 'DM Sans', sans-serif; font-weight: 400; color: #8E8E93; letter-spacing: 0; }
.config-empty { font-size: 0.8rem; color: #636366; padding: 1.5rem; text-align: center; border: 1px dashed #3A3A3C; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field-hint  { font-size: 0.7rem; color: #636366; margin-top: 0.1rem; }
.field-error { font-size: 0.78rem; color: #4A9EFF; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

/* Exercise picker */
.search-wrap-sm { margin-bottom: 0.4rem; }
.bp-chips { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.35rem; }
.bp-chip {
  background: #252528; border: 1px solid #3A3A3C; color: #636366;
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.6rem; font-weight: 700;
  letter-spacing: 0.08em; padding: 0.15rem 0.5rem; cursor: pointer;
  text-transform: capitalize; transition: all 0.12s;
}
.bp-chip.active { background: rgba(74,158,255,0.1); border-color: #4A9EFF; color: #4A9EFF; }
.ex-picker { border: 1px solid #252528; flex: 1; min-height: 200px; max-height: 440px; overflow-y: auto; background: #1C1C1E; }
.ex-pick-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.75rem; cursor: pointer; border-bottom: 1px solid #1C1C1E; }
.ex-pick-row:hover { background: #1E1E22; }
.ex-pick-row.selected { background: rgba(74,158,255,0.06); }
.ex-pick-row i { font-size: 0.85rem; color: #636366; flex-shrink: 0; }
.ex-pick-row.selected i { color: #4A9EFF; }
.ex-pick-name { flex: 1; font-size: 0.82rem; color: #C7C7CC; }
.ex-pick-bp { font-size: 0.62rem; color: #636366; white-space: nowrap; }

/* Exercise configuration */
.ex-config-list { display: flex; flex-direction: column; gap: 0.5rem; }
.ex-config-row { background: #1C1C1E; border: 1px solid #252528; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.ex-config-header { display: flex; align-items: center; justify-content: space-between; }
.ex-config-info { display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; }
.ex-config-num { font-family: 'Barlow Condensed', sans-serif; font-size: 0.75rem; font-weight: 900; color: #4A9EFF; width: 18px; flex-shrink: 0; }
.ex-config-name { font-size: 0.82rem; color: #C7C7CC; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ex-config-actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
.ex-config-fields { display: flex; gap: 0.75rem; }
.ex-config-note { }
.note-input { font-size: 0.78rem; }
.mini-field { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
.mini-field.full-width { flex: none; width: 100%; }
.mini-label { font-family: 'Barlow Condensed', sans-serif; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.1em; color: #636366; }
.mini-input { background: #252528; border: 1px solid #3A3A3C; color: #EBEBEB; font-family: 'DM Sans', sans-serif; font-size: 0.82rem; padding: 0.3rem 0.4rem; width: 100%; box-sizing: border-box; }
.mini-input:focus { outline: none; border-color: #4A9EFF; }
.icon-btn { background: none; border: 1px solid #252528; color: #636366; cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; transition: all 0.15s; }
.icon-btn:hover:not(:disabled) { color: #AEAEB2; border-color: #3A3A3C; }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.icon-btn.danger:hover { color: #4A9EFF; border-color: #4A9EFF; }
</style>
