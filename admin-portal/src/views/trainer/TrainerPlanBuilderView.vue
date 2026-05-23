<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">PLAN BUILDER</h1>
        <div class="page-sub">Create and assign training programs to your clients</div>
      </div>
      <button class="btn btn-primary" @click="openCreate"><i class="pi pi-plus" /> NEW PLAN</button>
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
      <table class="data-table">
        <thead><tr><th>Plan Name</th><th>Exercises</th><th>Assigned To</th><th>Starts</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr v-for="p in filteredPlans" :key="p.assignment_id">
            <td class="td-name">{{ p.name }}</td>
            <td class="td-val">{{ p.exercise_count }}</td>
            <td class="td-muted">{{ clientName(p.client_id) }}</td>
            <td class="td-muted">{{ p.starts_at ?? '—' }}</td>
            <td>
              <span class="status-badge" :class="p.is_active ? 'active' : 'archived'">
                {{ p.is_active ? 'Active' : 'Archived' }}
              </span>
            </td>
            <td class="td-actions">
              <button class="btn btn-ghost btn-sm" @click="openEdit(p)"><i class="pi pi-pencil" /></button>
              <button class="btn btn-ghost btn-sm" @click="toggleActive(p)">
                <i class="pi" :class="p.is_active ? 'pi-eye-slash' : 'pi-eye'" />
              </button>
            </td>
          </tr>
          <tr v-if="filteredPlans.length === 0"><td colspan="6" class="td-empty">No plans found</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Create / Edit slide panel -->
    <div v-if="panel" class="overlay" @click.self="closePanel">
      <div class="slide-panel">
        <div class="panel-header">
          <div class="panel-title">{{ panel === 'create' ? 'NEW PLAN' : 'EDIT PLAN' }}</div>
          <button class="panel-close" @click="closePanel"><i class="pi pi-times" /></button>
        </div>
        <div class="panel-body">
          <div class="field">
            <label class="mf-label">PLAN NAME</label>
            <input v-model="form.name" class="mf-input" placeholder="e.g. Week 1–4 Strength Block" />
          </div>
          <div class="field">
            <label class="mf-label">NOTES</label>
            <textarea v-model="form.notes" class="mf-textarea" rows="2" placeholder="Program overview…" />
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
            <input v-model="form.starts_at" type="date" class="mf-input" />
          </div>

          <!-- Exercise picker -->
          <div class="field">
            <label class="mf-label">ADD EXERCISES</label>
            <div class="search-wrap-sm">
              <i class="pi pi-search search-icon-sm" />
              <input v-model="exQuery" class="search-input-sm" placeholder="Search exercises…" />
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
                  <div class="mini-field"><label class="mini-label">SETS</label><input v-model.number="ex.target_sets" type="number" min="1" max="20" class="mini-input" /></div>
                  <div class="mini-field"><label class="mini-label">REPS</label><input v-model.number="ex.target_reps" type="number" min="1" max="100" class="mini-input" placeholder="—" /></div>
                  <div class="mini-field"><label class="mini-label">SUPERSET #</label><input v-model.number="ex.superset_group" type="number" min="1" max="10" class="mini-input" placeholder="—" /></div>
                </div>
                <input v-model="ex.notes" class="mf-input note-input" placeholder="Notes for this exercise…" />
              </div>
            </div>
          </div>

          <div v-if="saveError" class="field-error">{{ saveError }}</div>
        </div>
        <div class="panel-footer">
          <button class="btn btn-ghost" @click="closePanel">Cancel</button>
          <button class="btn btn-primary" :disabled="!form.name.trim() || !form.clientIds.length || saving" @click="handleSave">
            {{ saving ? 'Saving…' : panel === 'create' ? 'CREATE & ASSIGN' : 'SAVE' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { v4 as uuidv4 } from 'uuid'

interface PlanRow { assignment_id: string; template_id: string; name: string; notes: string | null; exercise_count: number; client_id: string; starts_at: string | null; is_active: boolean }
interface ExercConfig { exerciseId: string; name: string; body_part: string; target_sets: number; target_reps: number | null; notes: string | null; superset_group: number | null }
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
const exQuery = ref('')
const panel   = ref<'create' | 'edit' | null>(null)
const editingTemplateId = ref<string | null>(null)
const form    = reactive({ name: '', notes: '', starts_at: '', clientIds: [] as string[], exercises: [] as ExercConfig[] })

const filteredPlans = computed(() => clientFilter.value ? plans.value.filter(p => p.client_id === clientFilter.value) : plans.value)
const filteredExercises = computed(() => {
  if (!exQuery.value.trim()) return exercises.value
  return exercises.value.filter(e => e.name.toLowerCase().includes(exQuery.value.toLowerCase()))
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
  if (idx === -1) form.exercises.push({ exerciseId: ex.id, name: ex.name, body_part: ex.body_part, target_sets: 3, target_reps: null, notes: null, superset_group: null })
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
  if (clientFilter.value) form.clientIds = [clientFilter.value]
}

async function openEdit(p: PlanRow) {
  editingTemplateId.value = p.template_id
  form.name = p.name; form.notes = p.notes ?? ''; form.starts_at = p.starts_at ?? ''; saveError.value = ''
  // All clients sharing this template
  const { data: tpa } = await supabase.from('trainer_plan_assignments').select('client_id').eq('template_id', p.template_id).eq('trainer_id', auth.user!.id)
  form.clientIds = (tpa ?? []).map(r => r.client_id)
  const { data: exData } = await supabase.from('template_exercises').select('exercise_id, position, target_sets, target_reps, notes, superset_group').eq('template_id', p.template_id).order('position')
  form.exercises = (exData ?? []).map(r => {
    const ex = exercises.value.find(e => e.id === r.exercise_id)
    return { exerciseId: r.exercise_id, name: ex?.name ?? r.exercise_id.slice(0, 8), body_part: ex?.body_part ?? '', target_sets: r.target_sets ?? 3, target_reps: r.target_reps ?? null, notes: r.notes ?? null, superset_group: r.superset_group ?? null }
  })
  exQuery.value = ''; panel.value = 'edit'
}

function closePanel() { panel.value = null }

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
        target_sets: ex.target_sets || 3, target_reps: ex.target_reps || null,
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
        target_sets: ex.target_sets || 3, target_reps: ex.target_reps || null,
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

  saving.value = false; closePanel(); await load()
}

async function toggleActive(p: PlanRow) {
  await supabase.from('trainer_plan_assignments').update({ is_active: !p.is_active }).eq('id', p.assignment_id)
  p.is_active = !p.is_active
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
.filter-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }

.table-wrap { overflow: hidden; }
.td-name  { color: #C0C0C0; font-weight: 500; }
.td-muted { color: #555; font-size: 0.78rem; }
.td-val   { color: #888; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
.td-empty { color: #333; font-size: 0.8rem; text-align: center; padding: 2rem; }
.td-actions { display: flex; gap: 0.35rem; }

.status-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.15rem 0.4rem; border: 1px solid; }
.status-badge.active   { color: #4CAF50; border-color: rgba(76,175,80,0.3); background: rgba(76,175,80,0.08); }
.status-badge.archived { color: #444; border-color: #2A2A2A; }

/* Slide panel */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; }
.slide-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 480px; background: #111; border-left: 1px solid #2A2A2A; display: flex; flex-direction: column; z-index: 101; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid #1A1A1A; }
.panel-title  { font-family: 'Barlow Condensed', sans-serif; font-size: 1.1rem; font-weight: 800; color: #F0F0F0; letter-spacing: 0.08em; }
.panel-close  { background: none; border: none; color: #555; cursor: pointer; }
.panel-body   { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.panel-footer { padding: 1rem 1.5rem; border-top: 1px solid #1A1A1A; display: flex; gap: 0.75rem; justify-content: flex-end; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field-error { font-size: 0.78rem; color: #FF4D00; }

.client-picker { border: 1px solid #1A1A1A; max-height: 140px; overflow-y: auto; background: #0A0A0A; }
.client-pick-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid #111; }
.client-pick-row:hover { background: #141414; }
.client-pick-row.selected { background: rgba(255,77,0,0.06); }
.client-pick-row i { font-size: 0.85rem; color: #444; }
.client-pick-row.selected i { color: #FF4D00; }
.pick-name { flex: 1; font-size: 0.82rem; color: #C0C0C0; }
.pick-sub  { font-size: 0.65rem; color: #444; }

.search-wrap-sm { position: relative; margin-bottom: 0.4rem; }
.search-icon-sm { position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); color: #444; font-size: 0.75rem; }
.search-input-sm { width: 100%; background: #0A0A0A; border: 1px solid #2A2A2A; color: #E0E0E0; padding: 0.45rem 0.6rem 0.45rem 2rem; font-size: 0.8rem; box-sizing: border-box; }
.ex-picker { border: 1px solid #1A1A1A; max-height: 160px; overflow-y: auto; background: #0A0A0A; }
.ex-pick-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.75rem; cursor: pointer; border-bottom: 1px solid #111; }
.ex-pick-row:hover { background: #141414; }
.ex-pick-row.selected { background: rgba(255,77,0,0.06); }
.ex-pick-row i { font-size: 0.85rem; color: #444; }
.ex-pick-row.selected i { color: #FF4D00; }
.ex-pick-name { flex: 1; font-size: 0.82rem; color: #C0C0C0; }
.ex-pick-bp { font-size: 0.62rem; color: #444; }

.ex-config-list { display: flex; flex-direction: column; gap: 0.5rem; }
.ex-config-row { background: #0D0D0D; border: 1px solid #1A1A1A; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.ex-config-header { display: flex; align-items: center; justify-content: space-between; }
.ex-config-info { display: flex; align-items: center; gap: 0.5rem; flex: 1; }
.ex-config-num  { font-family: 'Barlow Condensed', sans-serif; font-size: 0.75rem; font-weight: 900; color: #FF4D00; width: 18px; }
.ex-config-name { font-size: 0.82rem; color: #C0C0C0; font-weight: 500; }
.ex-config-actions { display: flex; gap: 0.25rem; }
.ex-config-fields { display: flex; gap: 0.75rem; }
.note-input { font-size: 0.78rem; }
.mini-field { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
.mini-label { font-family: 'Barlow Condensed', sans-serif; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.1em; color: #444; }
.mini-input { background: #1A1A1A; border: 1px solid #2A2A2A; color: #E0E0E0; font-family: 'DM Sans', sans-serif; font-size: 0.82rem; padding: 0.3rem 0.4rem; width: 100%; box-sizing: border-box; }
.icon-btn { background: none; border: 1px solid #1A1A1A; color: #444; cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; }
.icon-btn:hover:not(:disabled) { color: #888; border-color: #2A2A2A; }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.icon-btn.danger:hover { color: #FF4D00; border-color: #FF4D00; }
</style>
