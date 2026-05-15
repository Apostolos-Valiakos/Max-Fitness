<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">EXERCISES</h1>
        <div class="page-sub">Global library — {{ filtered.length }} exercises</div>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost" @click="exportCSV"><i class="pi pi-download" /> Export CSV</button>
        <button class="btn btn-ghost" @click="importInput?.click()"><i class="pi pi-upload" /> Import CSV</button>
        <input ref="importInput" type="file" accept=".csv" style="display:none" @change="handleImport" />
        <button class="btn btn-primary" @click="openCreate"><i class="pi pi-plus" /> ADD EXERCISE</button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters card">
      <div class="search-wrap">
        <i class="pi pi-search search-icon" />
        <input v-model="query" class="search-input" placeholder="Search exercises..." />
      </div>
      <div class="filter-chips">
        <button class="chip" :class="{ active: !bpFilter }" @click="bpFilter = ''">ALL</button>
        <button v-for="bp in BODY_PARTS" :key="bp" class="chip" :class="{ active: bpFilter === bp }" @click="bpFilter = bpFilter === bp ? '' : bp">
          {{ bp.replace('_', ' ').toUpperCase() }}
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="card table-wrap">
      <div v-if="loading" class="loading"><i class="pi pi-spin pi-spinner" /> Loading...</div>
      <table v-else class="data-table">
        <thead><tr><th>Name</th><th>Muscle group</th><th>Equipment</th><th>Target Muscle</th><th>Instructions</th><th></th></tr></thead>
        <tbody>
          <tr v-for="ex in filtered" :key="ex.id">
            <td class="td-name">{{ ex.name }}</td>
            <td><span class="chip-tag">{{ ex.body_part.replace('_', ' ') }}</span></td>
            <td><span class="chip-tag eq">{{ ex.equipment }}</span></td>
            <td class="td-muted">{{ ex.target_muscle ?? '—' }}</td>
            <td class="td-instructions">{{ ex.instructions ? ex.instructions.slice(0, 60) + (ex.instructions.length > 60 ? '…' : '') : '—' }}</td>
            <td class="td-actions">
              <button class="btn btn-ghost btn-sm" @click="openEdit(ex)"><i class="pi pi-pencil" /></button>
              <button class="btn btn-danger btn-sm" @click="confirmDelete(ex)"><i class="pi pi-trash" /></button>
            </td>
          </tr>
          <tr v-if="filtered.length === 0"><td colspan="6" class="td-empty">No exercises found</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Slide-over panel -->
    <div v-if="panel" class="overlay" @click.self="panel = null">
      <div class="slide-panel">
        <div class="panel-header">
          <div class="panel-title">{{ panel === 'create' ? 'NEW EXERCISE' : 'EDIT EXERCISE' }}</div>
          <button class="panel-close" @click="panel = null"><i class="pi pi-times" /></button>
        </div>

        <div class="panel-body">
          <div class="field"><label class="mf-label">NAME</label><input v-model="form.name" class="mf-input" placeholder="e.g. Barbell Row" /></div>
          <div class="field">
            <label class="mf-label">MUSCLE GROUP</label>
            <select v-model="form.body_part" class="mf-select">
              <option v-for="bp in BODY_PARTS" :key="bp" :value="bp">{{ bp.replace('_', ' ') }}</option>
            </select>
          </div>
          <div class="field">
            <label class="mf-label">EQUIPMENT</label>
            <select v-model="form.equipment" class="mf-select">
              <option v-for="eq in EQUIPMENT" :key="eq" :value="eq">{{ eq }}</option>
            </select>
          </div>
          <div class="field"><label class="mf-label">TARGET MUSCLE (specific)</label><input v-model="form.target_muscle" class="mf-input" placeholder="e.g. Pectoralis Major" /></div>
          <div class="field">
            <label class="mf-label">INSTRUCTIONS</label>
            <textarea v-model="form.instructions" class="mf-textarea" placeholder="Step-by-step instructions..." rows="5" />
          </div>
          <div class="field">
            <label class="mf-label">STICKY NOTE (permanent cue)</label>
            <textarea v-model="form.sticky_note" class="mf-textarea" placeholder="e.g. Keep elbows tucked, retract scapula..." rows="3" />
          </div>
        </div>

        <div class="panel-footer">
          <button class="btn btn-ghost" @click="panel = null">Cancel</button>
          <button class="btn btn-primary" :disabled="!form.name" @click="handleSave">
            {{ panel === 'create' ? 'CREATE' : 'SAVE CHANGES' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="deleteTarget" class="modal-backdrop" @click.self="deleteTarget = null">
      <div class="modal">
        <div class="modal-title">Delete Exercise?</div>
        <p class="modal-body">Delete <strong>{{ deleteTarget.name }}</strong>? This cannot be undone (fails if any sets reference this exercise).</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-danger" @click="handleDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Exercise, BodyPart, Equipment } from '@/lib/database.types'

const BODY_PARTS: BodyPart[] = ['chest','back','shoulders','biceps','triceps','forearms','quads','hamstrings','glutes','calves','core','full_body']
const EQUIPMENT: Equipment[] = ['barbell','dumbbell','cable','machine','bodyweight','kettlebell','band','other']

const loading      = ref(true)
const exercises    = ref<Exercise[]>([])
const query        = ref('')
const bpFilter     = ref('')
const panel        = ref<'create' | 'edit' | null>(null)
const editingId    = ref<string | null>(null)
const deleteTarget = ref<Exercise | null>(null)
const importInput  = ref<HTMLInputElement | null>(null)

const form = reactive({
  name: '',
  body_part: 'chest' as BodyPart,
  equipment: 'barbell' as Equipment,
  instructions: '',
  target_muscle: '',
  sticky_note: '',
})

const filtered = computed(() => {
  let list = exercises.value
  if (bpFilter.value) list = list.filter(e => e.body_part === bpFilter.value)
  if (query.value.trim()) list = list.filter(e => e.name.toLowerCase().includes(query.value.toLowerCase()))
  return list
})

onMounted(async () => { await loadExercises() })

async function loadExercises() {
  loading.value = true
  const { data } = await supabase.from('exercises').select('*').is('created_by', null).order('body_part').order('name')
  exercises.value = (data ?? []) as Exercise[]
  loading.value = false
}

function openCreate() {
  form.name = ''; form.body_part = 'chest'; form.equipment = 'barbell'
  form.instructions = ''; form.target_muscle = ''; form.sticky_note = ''
  editingId.value = null; panel.value = 'create'
}

function openEdit(ex: Exercise) {
  form.name = ex.name; form.body_part = ex.body_part; form.equipment = ex.equipment
  form.instructions = ex.instructions ?? ''; form.target_muscle = ex.target_muscle ?? ''; form.sticky_note = ex.sticky_note ?? ''
  editingId.value = ex.id; panel.value = 'edit'
}

async function handleSave() {
  const payload = {
    name: form.name, body_part: form.body_part, equipment: form.equipment,
    instructions: form.instructions || null, is_custom: false, created_by: null,
    target_muscle: form.target_muscle || null,
    sticky_note: form.sticky_note || null,
  }
  if (panel.value === 'create') {
    const { data } = await supabase.from('exercises').insert(payload).select().single()
    if (data) exercises.value.unshift(data as Exercise)
  } else if (editingId.value) {
    await supabase.from('exercises').update(payload).eq('id', editingId.value)
    const idx = exercises.value.findIndex(e => e.id === editingId.value)
    if (idx >= 0) exercises.value[idx] = { ...exercises.value[idx], ...payload }
  }
  panel.value = null
}

function confirmDelete(ex: Exercise) { deleteTarget.value = ex }
async function handleDelete() {
  if (!deleteTarget.value) return
  const { error } = await supabase.from('exercises').delete().eq('id', deleteTarget.value.id)
  if (!error) exercises.value = exercises.value.filter(e => e.id !== deleteTarget.value!.id)
  deleteTarget.value = null
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCSV() {
  const headers = ['name','body_part','equipment','target_muscle','instructions','sticky_note']
  const rows = exercises.value.map(e => [
    e.name, e.body_part, e.equipment,
    e.target_muscle ?? '', e.instructions ?? '', e.sticky_note ?? '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'exercises.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ── CSV Import ────────────────────────────────────────────────────────────────

async function handleImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const text = await file.text()
  const lines = text.trim().split('\n')
  if (lines.length < 2) return
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
  const nameIdx  = header.indexOf('name')
  const bpIdx    = header.indexOf('body_part')
  const eqIdx    = header.indexOf('equipment')
  const tmIdx    = header.indexOf('target_muscle')
  const instrIdx = header.indexOf('instructions')
  const snIdx    = header.indexOf('sticky_note')
  if (nameIdx === -1 || bpIdx === -1 || eqIdx === -1) return alert('CSV must have name, body_part, equipment columns')

  const parseRow = (line: string) => {
    const cols: string[] = []
    let cur = ''; let inQ = false
    for (const c of line) {
      if (c === '"') { inQ = !inQ }
      else if (c === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
      else cur += c
    }
    cols.push(cur.trim())
    return cols
  }

  const toInsert = lines.slice(1).map(line => {
    const cols = parseRow(line)
    return {
      name: cols[nameIdx] ?? '',
      body_part: (cols[bpIdx] ?? 'chest') as BodyPart,
      equipment: (cols[eqIdx] ?? 'barbell') as Equipment,
      target_muscle: tmIdx >= 0 && cols[tmIdx] ? cols[tmIdx] : null,
      instructions: instrIdx >= 0 && cols[instrIdx] ? cols[instrIdx] : null,
      sticky_note: snIdx >= 0 && cols[snIdx] ? cols[snIdx] : null,
      is_custom: false, created_by: null,
    }
  }).filter(r => r.name.length > 0)

  if (!toInsert.length) return
  const { data, error } = await supabase.from('exercises').insert(toInsert).select()
  if (error) return alert('Import error: ' + error.message)
  exercises.value.unshift(...((data ?? []) as Exercise[]))
  if (importInput.value) importInput.value.value = ''
}
</script>

<style scoped>
.page { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.page-title  { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: #F0F0F0; letter-spacing: 0.05em; }
.page-sub    { font-size: 0.75rem; color: #444; margin-top: 0.2rem; }
.header-actions { display: flex; gap: 0.5rem; align-items: center; }

.filters { padding: 1rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
.search-wrap { position: relative; }
.search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #444; font-size: 0.85rem; }
.search-input { width: 100%; background: #1A1A1A; border: 1px solid #2A2A2A; color: #F0F0F0; font-family: 'DM Sans', sans-serif; font-size: 0.88rem; padding: 0.55rem 0.75rem 0.55rem 2.25rem; }
.search-input:focus { outline: none; border-color: #FF4D00; }
.filter-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.chip { background: #1A1A1A; border: 1px solid #2A2A2A; color: #555; font-family: 'Barlow Condensed', sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.2rem 0.65rem; cursor: pointer; transition: all 0.15s; }
.chip.active { background: rgba(255,77,0,0.1); border-color: #FF4D00; color: #FF4D00; }

.table-wrap { overflow: hidden; }
.loading { padding: 2rem; text-align: center; color: #444; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
.td-name  { color: #C0C0C0; font-weight: 500; }
.td-muted { color: #555; font-size: 0.78rem; }
.td-instructions { color: #444; font-size: 0.78rem; max-width: 200px; }
.td-actions { display: flex; gap: 0.35rem; }
.td-empty { color: #333; font-size: 0.8rem; text-align: center; padding: 2rem; }
.chip-tag { font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; background: #1A1A1A; border: 1px solid #2A2A2A; color: #666; padding: 0.15rem 0.4rem; text-transform: uppercase; }
.chip-tag.eq { color: #888; }

/* Slide panel */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; }
.slide-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 420px; background: #111; border-left: 1px solid #2A2A2A; display: flex; flex-direction: column; z-index: 101; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid #1A1A1A; }
.panel-title  { font-family: 'Barlow Condensed', sans-serif; font-size: 1.1rem; font-weight: 800; color: #F0F0F0; letter-spacing: 0.08em; }
.panel-close  { background: none; border: none; color: #555; cursor: pointer; font-size: 0.9rem; transition: color 0.15s; }
.panel-close:hover { color: #F0F0F0; }
.panel-body   { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.panel-footer { padding: 1rem 1.5rem; border-top: 1px solid #1A1A1A; display: flex; gap: 0.75rem; justify-content: flex-end; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }

/* Modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 200; }
.modal { background: #111; border: 1px solid #2A2A2A; padding: 1.5rem; width: 360px; }
.modal-title  { font-family: 'Barlow Condensed', sans-serif; font-size: 1.2rem; font-weight: 800; color: #F0F0F0; margin-bottom: 0.75rem; }
.modal-body   { font-size: 0.85rem; color: #888; line-height: 1.5; margin-bottom: 1.5rem; }
.modal-body strong { color: #F0F0F0; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
</style>
