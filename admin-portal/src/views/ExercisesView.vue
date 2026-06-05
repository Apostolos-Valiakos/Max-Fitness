<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">EXERCISES</h1>
        <div class="page-sub">Global library — {{ filtered.length }} exercises</div>
      </div>
      <div class="header-actions">
        <Button severity="secondary" @click="exportCSV"><i class="pi pi-download" /> Export CSV</Button>
        <Button severity="secondary" @click="importInput?.click()"><i class="pi pi-upload" /> Import CSV</Button>
        <input ref="importInput" type="file" accept=".csv" style="display:none" @change="handleImport" />
        <Button @click="openCreate"><i class="pi pi-plus" /> ADD EXERCISE</Button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters card">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="query" placeholder="Search exercises..." style="width:100%" />
      </IconField>
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
      <DataTable v-else :value="filtered" :paginator="true" :rows="25" removable-sort>
        <Column field="name" header="Name" sortable>
          <template #body="{ data }">
            <span class="td-name">{{ data.name }}</span>
          </template>
        </Column>
        <Column field="body_part" header="Muscle group" sortable>
          <template #body="{ data }">
            <span class="chip-tag">{{ data.body_part.replace('_', ' ') }}</span>
          </template>
        </Column>
        <Column field="equipment" header="Equipment" sortable>
          <template #body="{ data }">
            <span class="chip-tag eq">{{ data.equipment }}</span>
          </template>
        </Column>
        <Column field="target_muscle" header="Target Muscle">
          <template #body="{ data }">
            <span class="td-muted">{{ data.target_muscle ?? '—' }}</span>
          </template>
        </Column>
        <Column field="instructions" header="Instructions">
          <template #body="{ data }">
            <span class="td-instructions">{{ data.instructions ? data.instructions.slice(0, 60) + (data.instructions.length > 60 ? '…' : '') : '—' }}</span>
          </template>
        </Column>
        <Column header="">
          <template #body="{ data }">
            <div class="td-actions">
              <Button severity="secondary" size="small" @click="openEdit(data)"><i class="pi pi-pencil" /></Button>
              <Button severity="danger" size="small" @click="confirmDelete(data)"><i class="pi pi-trash" /></Button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Slide-over panel (Drawer) -->
    <Drawer v-model:visible="drawerVisible" position="right" :header="panel === 'create' ? 'NEW EXERCISE' : 'EDIT EXERCISE'" :style="{ width: '480px' }">
      <div class="panel-body">
        <div class="field"><label class="mf-label">NAME</label><InputText v-model="form.name" placeholder="e.g. Barbell Row" style="width:100%" /></div>
        <div class="field">
          <label class="mf-label">MUSCLE GROUP</label>
          <Select v-model="form.body_part" :options="BODY_PARTS_OPTIONS" option-label="label" option-value="value" style="width:100%" />
        </div>
        <div class="field">
          <label class="mf-label">EQUIPMENT</label>
          <Select v-model="form.equipment" :options="EQUIPMENT_OPTIONS" option-label="label" option-value="value" style="width:100%" />
        </div>
        <div class="field"><label class="mf-label">TARGET MUSCLE (specific)</label><InputText v-model="form.target_muscle" placeholder="e.g. Pectoralis Major" style="width:100%" /></div>
        <div class="field">
          <label class="mf-label">INSTRUCTIONS</label>
          <Textarea v-model="form.instructions" placeholder="Step-by-step instructions..." :rows="5" style="width:100%" />
        </div>
        <div class="field">
          <label class="mf-label">STICKY NOTE (permanent cue)</label>
          <Textarea v-model="form.sticky_note" placeholder="e.g. Keep elbows tucked, retract scapula..." :rows="3" style="width:100%" />
        </div>
      </div>
      <template #footer>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <Button severity="secondary" @click="drawerVisible = false">Cancel</Button>
          <Button :disabled="!form.name" @click="handleSave">
            {{ panel === 'create' ? 'CREATE' : 'SAVE CHANGES' }}
          </Button>
        </div>
      </template>
    </Drawer>

    <!-- Delete confirm Dialog -->
    <Dialog v-model:visible="deleteDialogVisible" header="Delete Exercise?" :style="{ width: '360px' }" :modal="true">
      <p class="modal-body">Delete <strong>{{ deleteTarget?.name }}</strong>? This cannot be undone (fails if any sets reference this exercise).</p>
      <template #footer>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <Button severity="secondary" @click="deleteDialogVisible = false">Cancel</Button>
          <Button severity="danger" @click="handleDelete">Delete</Button>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Exercise, BodyPart, Equipment } from '@/lib/database.types'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import Drawer from 'primevue/drawer'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'

const BODY_PARTS: BodyPart[] = ['chest','back','shoulders','biceps','triceps','forearms','quads','hamstrings','glutes','calves','core','full_body']
const EQUIPMENT: Equipment[] = ['barbell','dumbbell','cable','machine','bodyweight','kettlebell','band','other']

const BODY_PARTS_OPTIONS = BODY_PARTS.map(bp => ({ label: bp.replace('_', ' '), value: bp }))
const EQUIPMENT_OPTIONS  = EQUIPMENT.map(eq => ({ label: eq, value: eq }))

const loading      = ref(true)
const exercises    = ref<Exercise[]>([])
const query        = ref('')
const bpFilter     = ref('')
const panel        = ref<'create' | 'edit' | null>(null)
const drawerVisible = ref(false)
const editingId    = ref<string | null>(null)
const deleteTarget = ref<Exercise | null>(null)
const deleteDialogVisible = ref(false)
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
  editingId.value = null; panel.value = 'create'; drawerVisible.value = true
}

function openEdit(ex: Exercise) {
  form.name = ex.name; form.body_part = ex.body_part; form.equipment = ex.equipment
  form.instructions = ex.instructions ?? ''; form.target_muscle = ex.target_muscle ?? ''; form.sticky_note = ex.sticky_note ?? ''
  editingId.value = ex.id; panel.value = 'edit'; drawerVisible.value = true
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
  drawerVisible.value = false
}

function confirmDelete(ex: Exercise) { deleteTarget.value = ex; deleteDialogVisible.value = true }
async function handleDelete() {
  if (!deleteTarget.value) return
  const { error } = await supabase.from('exercises').delete().eq('id', deleteTarget.value.id)
  if (!error) exercises.value = exercises.value.filter(e => e.id !== deleteTarget.value!.id)
  deleteTarget.value = null; deleteDialogVisible.value = false
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
.page-sub    { font-size: 0.75rem; color: #636366; margin-top: 0.2rem; }
.header-actions { display: flex; gap: 0.5rem; align-items: center; }

.filters { padding: 1rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
.filter-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.chip { background: #252528; border: 1px solid #3A3A3C; color: #636366; font-family: 'Barlow Condensed', sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.2rem 0.65rem; cursor: pointer; transition: all 0.15s; }
.chip.active { background: rgba(74,158,255,0.1); border-color: #4A9EFF; color: #4A9EFF; }

.table-wrap { overflow: hidden; }
.loading { padding: 2rem; text-align: center; color: #636366; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
.td-name  { color: #C7C7CC; font-weight: 500; }
.td-muted { color: #636366; font-size: 0.78rem; }
.td-instructions { color: #636366; font-size: 0.78rem; max-width: 200px; }
.td-actions { display: flex; gap: 0.35rem; }
.chip-tag { font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; background: #252528; border: 1px solid #3A3A3C; color: #8E8E93; padding: 0.15rem 0.4rem; text-transform: uppercase; }
.chip-tag.eq { color: #AEAEB2; }

.panel-body { display: flex; flex-direction: column; gap: 1.25rem; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }

.modal-body { font-size: 0.85rem; color: #AEAEB2; line-height: 1.5; margin-bottom: 0.5rem; }
.modal-body strong { color: #F0F0F0; }
</style>
