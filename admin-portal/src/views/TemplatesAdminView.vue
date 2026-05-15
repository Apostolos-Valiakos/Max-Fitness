<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">TEMPLATES</h1>
        <div class="page-sub">Public templates visible to users based on tier</div>
      </div>
      <button class="btn btn-primary" @click="openCreate">
        <i class="pi pi-plus" /> NEW TEMPLATE
      </button>
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
      <table class="data-table">
        <thead>
          <tr><th>Name</th><th>Folder</th><th>Exercises</th><th>Created By</th><th>Visibility</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="t in filtered" :key="t.id">
            <td class="td-name">{{ t.name }}</td>
            <td class="td-muted">{{ t.folder_name ?? '—' }}</td>
            <td class="td-val">{{ t.exercise_count }}</td>
            <td class="td-muted">{{ creatorName(t.owner_id) }}</td>
            <td>
              <span class="vis-badge" :class="t.visibility">{{ visLabel(t.visibility) }}</span>
            </td>
            <td class="td-actions">
              <button class="btn btn-ghost btn-sm" @click="openEdit(t)"><i class="pi pi-pencil" /></button>
              <button class="btn btn-danger btn-sm" @click="deleteTemplate(t.id)"><i class="pi pi-trash" /></button>
            </td>
          </tr>
          <tr v-if="filtered.length === 0"><td colspan="6" class="td-empty">No templates found</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Create / Edit slide panel -->
    <div v-if="panel" class="overlay" @click.self="closePanel">
      <div class="slide-panel wide-panel">
        <div class="panel-header">
          <div class="panel-title">{{ panel === 'create' ? 'NEW TEMPLATE' : 'EDIT TEMPLATE' }}</div>
          <button class="panel-close" @click="closePanel"><i class="pi pi-times" /></button>
        </div>

        <div class="panel-body">
          <!-- Basic info -->
          <div class="field">
            <label class="mf-label">TEMPLATE NAME</label>
            <input v-model="form.name" class="mf-input" placeholder="e.g. Beginner Full Body" />
          </div>

          <div class="field">
            <label class="mf-label">NOTES (optional)</label>
            <textarea v-model="form.notes" class="mf-textarea" rows="2" placeholder="Brief description…" />
          </div>

          <div class="two-col">
            <div class="field">
              <label class="mf-label">VISIBILITY</label>
              <select v-model="form.visibility" class="mf-select">
                <option v-for="v in VISIBILITIES_ALL" :key="v.value" :value="v.value">{{ v.label }}</option>
              </select>
              <div class="field-hint">{{ visHint(form.visibility) }}</div>
            </div>
            <div class="field">
              <label class="mf-label">FOLDER / PROGRAM</label>
              <input v-model="form.folder_name" class="mf-input" placeholder="e.g. Strength Block A" list="folder-list" />
              <datalist id="folder-list">
                <option v-for="f in allFolders" :key="f" :value="f" />
              </datalist>
            </div>
          </div>

          <!-- Exercise picker -->
          <div class="field">
            <label class="mf-label">ADD EXERCISES</label>
            <div class="search-wrap-sm">
              <i class="pi pi-search search-icon-sm" />
              <input v-model="exQuery" class="search-input-sm" placeholder="Search exercises…" />
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

          <!-- Exercise configuration -->
          <div v-if="form.exercises.length" class="field">
            <label class="mf-label">EXERCISE CONFIGURATION ({{ form.exercises.length }} exercises)</label>
            <div class="ex-config-list">
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
                  <div class="mini-field">
                    <label class="mini-label">SETS</label>
                    <input v-model.number="ex.target_sets" type="number" min="1" max="20" class="mini-input" />
                  </div>
                  <div class="mini-field">
                    <label class="mini-label">REPS</label>
                    <input v-model.number="ex.target_reps" type="number" min="1" max="100" class="mini-input" placeholder="—" />
                  </div>
                  <div class="mini-field">
                    <label class="mini-label">SUPERSET #</label>
                    <input v-model.number="ex.superset_group" type="number" min="1" max="10" class="mini-input" placeholder="—" />
                  </div>
                </div>
                <div class="ex-config-note">
                  <input v-model="ex.notes" class="mf-input note-input" placeholder="Notes for this exercise (optional)…" />
                </div>
              </div>
            </div>
          </div>

          <div v-if="saveError" class="field-error">{{ saveError }}</div>
        </div>

        <div class="panel-footer">
          <button class="btn btn-ghost" @click="closePanel">Cancel</button>
          <button class="btn btn-primary" :disabled="!form.name.trim() || saving" @click="handleSave">
            {{ saving ? 'Saving…' : panel === 'create' ? 'CREATE' : 'SAVE' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

interface AdminTemplate {
  id: string; owner_id: string; name: string; notes: string | null
  visibility: string; exercise_count: number; folder_name: string | null
}

interface ExercConfig {
  exerciseId: string; name: string; body_part: string
  target_sets: number; target_reps: number | null; notes: string | null; superset_group: number | null
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
const exQuery   = ref('')
const panel     = ref<'create' | 'edit' | null>(null)
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
  if (!exQuery.value.trim()) return exercises.value
  return exercises.value.filter(e => e.name.toLowerCase().includes(exQuery.value.toLowerCase()))
})

function creatorName(id: string) { return creators.value[id] ?? id.slice(0, 8) }
function isSelected(id: string) { return form.exercises.some(e => e.exerciseId === id) }

function toggleExercise(ex: { id: string; name: string; body_part: string }) {
  const idx = form.exercises.findIndex(e => e.exerciseId === ex.id)
  if (idx === -1) {
    form.exercises.push({ exerciseId: ex.id, name: ex.name, body_part: ex.body_part, target_sets: 3, target_reps: null, notes: null, superset_group: null })
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
  panel.value = 'create'
}

async function openEdit(t: AdminTemplate) {
  form.name = t.name; form.notes = t.notes ?? ''; form.visibility = t.visibility
  form.folder_name = t.folder_name ?? ''; saveError.value = ''; editingId.value = t.id; exQuery.value = ''
  const { data } = await supabase.from('template_exercises')
    .select('exercise_id, position, target_sets, target_reps, notes, superset_group')
    .eq('template_id', t.id).order('position')
  form.exercises = (data ?? []).map(r => {
    const ex = exercises.value.find(e => e.id === r.exercise_id)
    return {
      exerciseId: r.exercise_id, name: ex?.name ?? r.exercise_id.slice(0, 8), body_part: ex?.body_part ?? '',
      target_sets: r.target_sets ?? 3, target_reps: r.target_reps ?? null,
      notes: r.notes ?? null, superset_group: r.superset_group ?? null,
    }
  })
  panel.value = 'edit'
}

function closePanel() { panel.value = null }

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
    target_sets: ex.target_sets || 3, target_reps: ex.target_reps || null,
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
  saving.value = false; closePanel(); await load()
}

async function deleteTemplate(id: string) {
  await supabase.from('workout_templates').delete().eq('id', id)
  templates.value = templates.value.filter(t => t.id !== id)
}

onMounted(load)
</script>

<style scoped>
.page { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.page-title  { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: #F0F0F0; letter-spacing: 0.05em; }
.page-sub    { font-size: 0.75rem; color: #444; margin-top: 0.2rem; }
.loading-state { text-align: center; padding: 4rem; color: #444; }

.filters { padding: 0.875rem; margin-bottom: 1rem; }
.filter-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.filter-divider { width: 1px; height: 16px; background: #2A2A2A; margin: 0 0.2rem; }
.folder-chip i { font-size: 0.6rem; margin-right: 0.2rem; }

.table-wrap { padding: 0; overflow: hidden; }
.td-name  { color: #C0C0C0; font-weight: 500; }
.td-muted { color: #555; font-size: 0.78rem; }
.td-val   { color: #888; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
.td-empty { color: #333; font-size: 0.8rem; text-align: center; padding: 2rem; }
.td-actions { display: flex; gap: 0.35rem; }

.vis-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.15rem 0.4rem; border: 1px solid; }
.vis-badge.private { color: #444; border-color: #2A2A2A; }
.vis-badge.free    { color: #4CAF50; border-color: rgba(76,175,80,0.3); background: rgba(76,175,80,0.08); }
.vis-badge.paid    { color: #4DA6FF; border-color: rgba(77,166,255,0.3); background: rgba(77,166,255,0.08); }
.vis-badge.ultra   { color: #FFD700; border-color: rgba(255,215,0,0.3); background: rgba(255,215,0,0.08); }

/* Slide panel */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; }
.slide-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 480px; background: #111; border-left: 1px solid #2A2A2A; display: flex; flex-direction: column; z-index: 101; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid #1A1A1A; }
.panel-title  { font-family: 'Barlow Condensed', sans-serif; font-size: 1.1rem; font-weight: 800; color: #F0F0F0; letter-spacing: 0.08em; }
.panel-close  { background: none; border: none; color: #555; cursor: pointer; }
.panel-body   { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.panel-footer { padding: 1rem 1.5rem; border-top: 1px solid #1A1A1A; display: flex; gap: 0.75rem; justify-content: flex-end; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field-hint  { font-size: 0.7rem; color: #555; margin-top: 0.1rem; }
.field-error { font-size: 0.78rem; color: #FF4D00; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

/* Exercise picker */
.search-wrap-sm { position: relative; margin-bottom: 0.4rem; }
.search-icon-sm { position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); color: #444; font-size: 0.75rem; }
.search-input-sm { width: 100%; background: #0A0A0A; border: 1px solid #2A2A2A; color: #E0E0E0; padding: 0.45rem 0.6rem 0.45rem 2rem; font-size: 0.8rem; box-sizing: border-box; }
.ex-picker { border: 1px solid #1A1A1A; max-height: 180px; overflow-y: auto; background: #0A0A0A; }
.ex-pick-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.75rem; cursor: pointer; border-bottom: 1px solid #111; }
.ex-pick-row:hover { background: #141414; }
.ex-pick-row.selected { background: rgba(255,77,0,0.06); }
.ex-pick-row i { font-size: 0.85rem; color: #444; flex-shrink: 0; }
.ex-pick-row.selected i { color: #FF4D00; }
.ex-pick-name { flex: 1; font-size: 0.82rem; color: #C0C0C0; }
.ex-pick-bp { font-size: 0.62rem; color: #444; white-space: nowrap; }

/* Exercise configuration */
.ex-config-list { display: flex; flex-direction: column; gap: 0.5rem; }
.ex-config-row { background: #0D0D0D; border: 1px solid #1A1A1A; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.ex-config-header { display: flex; align-items: center; justify-content: space-between; }
.ex-config-info { display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; }
.ex-config-num { font-family: 'Barlow Condensed', sans-serif; font-size: 0.75rem; font-weight: 900; color: #FF4D00; width: 18px; flex-shrink: 0; }
.ex-config-name { font-size: 0.82rem; color: #C0C0C0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ex-config-actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
.ex-config-fields { display: flex; gap: 0.75rem; }
.ex-config-note { }
.note-input { font-size: 0.78rem; }
.mini-field { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
.mini-label { font-family: 'Barlow Condensed', sans-serif; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.1em; color: #444; }
.mini-input { background: #1A1A1A; border: 1px solid #2A2A2A; color: #E0E0E0; font-family: 'DM Sans', sans-serif; font-size: 0.82rem; padding: 0.3rem 0.4rem; width: 100%; box-sizing: border-box; }
.mini-input:focus { outline: none; border-color: #FF4D00; }
.icon-btn { background: none; border: 1px solid #1A1A1A; color: #444; cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; transition: all 0.15s; }
.icon-btn:hover:not(:disabled) { color: #888; border-color: #2A2A2A; }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.icon-btn.danger:hover { color: #FF4D00; border-color: #FF4D00; }
</style>
