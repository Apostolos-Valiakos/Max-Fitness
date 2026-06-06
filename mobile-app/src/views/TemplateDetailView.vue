<template>
  <div class="view">
    <!-- Header -->
    <div class="detail-header">
      <button class="back-btn" @click="router.back()"><i class="pi pi-arrow-left" /></button>

      <input
        v-if="isOwner"
        class="name-input"
        v-model="templateName"
        @blur="saveName"
        placeholder="Template name"
      />
      <div v-else class="name-display">{{ templateName }}</div>

      <!-- Admin: publish toggle -->
      <button
        v-if="auth.isAdmin && isOwner"
        class="publish-btn"
        :class="{ active: template?.is_public }"
        @click="togglePublish"
        :title="template?.is_public ? 'Unpublish from library' : 'Publish to library'"
      >
        <i :class="template?.is_public ? 'pi pi-eye' : 'pi pi-eye-slash'" />
        <span>{{ template?.is_public ? 'LIVE' : 'PUBLISH' }}</span>
      </button>
    </div>

    <!-- Template notes -->
    <div class="template-notes-row" v-if="isOwner">
      <input
        class="template-notes-input"
        v-model="templateNotesDraft"
        placeholder="Template description (optional)..."
        @blur="saveNotes"
      />
    </div>
    <div v-else-if="template?.notes" class="template-notes-display">{{ template.notes }}</div>

    <!-- ── EDIT MODE ─────────────────────────────────────────────── -->
    <template v-if="isOwner">
      <VueDraggable
        v-model="items"
        class="ex-list"
        handle=".drag-handle"
        :animation="200"
        @end="onDragEnd"
      >
        <div v-for="item in items" :key="item.te.id" class="ex-item">
          <!-- Drag handle -->
          <div class="drag-handle" title="Drag to reorder">
            <i class="pi pi-bars" />
          </div>

          <div class="ex-item-content">
            <div class="ex-item-name">{{ item.name }}</div>

            <!-- Sets / Reps / Rest row -->
            <div class="ex-fields-row">
              <div class="mini-field">
                <span class="mini-label">SETS</span>
                <input
                  class="mini-input"
                  type="number" inputmode="numeric" min="1"
                  :value="item.te.target_sets ?? 3"
                  @change="updateSets(item.te.id, $event)"
                />
              </div>
              <div class="mini-field">
                <span class="mini-label">REPS</span>
                <input
                  class="mini-input"
                  type="number" inputmode="numeric" min="1"
                  :value="item.te.target_reps ?? ''"
                  placeholder="—"
                  @change="updateReps(item.te.id, $event)"
                />
              </div>
              <div class="mini-field">
                <span class="mini-label">REST</span>
                <select
                  class="mini-select"
                  :value="item.te.rest_seconds ?? ''"
                  @change="updateRest(item.te.id, $event)"
                >
                  <option value="">—</option>
                  <option value="30">30s</option>
                  <option value="60">1m</option>
                  <option value="90">1m30</option>
                  <option value="120">2m</option>
                  <option value="180">3m</option>
                  <option value="300">5m</option>
                </select>
              </div>
            </div>

            <!-- Per-exercise note -->
            <input
              class="ex-note-input"
              type="text"
              placeholder="Exercise note (shown during workout)..."
              :value="item.te.notes ?? ''"
              @change="updateNotes(item.te.id, $event)"
            />
          </div>

          <button class="remove-btn" @click="removeExercise(item.te.id)">
            <i class="pi pi-times" />
          </button>
        </div>
      </VueDraggable>

      <div v-if="items.length === 0" class="empty-state">
        <i class="pi pi-dumbbell empty-icon" />
        <p>No exercises yet. Add some below.</p>
      </div>

      <button class="add-ex-btn" @click="pickerOpen = true">
        <i class="pi pi-plus" /> ADD EXERCISE
      </button>
    </template>

    <!-- ── PREVIEW MODE ──────────────────────────────────────────── -->
    <template v-else>
      <div v-if="items.length === 0" class="empty-state">
        <i class="pi pi-dumbbell empty-icon" />
        <p>No exercises in this template.</p>
      </div>
      <div v-else class="preview-list">
        <div v-for="item in items" :key="item.te.id" class="preview-item">
          <div class="preview-top">
            <div class="preview-name">{{ item.name }}</div>
            <div class="preview-targets">
              <span v-if="item.te.target_sets && item.te.target_reps" class="preview-tag">
                {{ item.te.target_sets }}×{{ item.te.target_reps }}
              </span>
              <span v-else-if="item.te.target_sets" class="preview-tag">
                {{ item.te.target_sets }} sets
              </span>
              <span v-if="item.te.rest_seconds" class="preview-tag rest-tag">
                {{ formatRest(item.te.rest_seconds) }} rest
              </span>
            </div>
          </div>
          <div v-if="item.te.notes" class="preview-note">{{ item.te.notes }}</div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="preview-actions">
        <button class="start-btn" @click="startWorkout" :disabled="items.length === 0">
          <i class="pi pi-play" /> START WORKOUT
        </button>
        <button class="dupe-btn" @click="handleDuplicate">
          <i class="pi pi-copy" /> SAVE COPY
        </button>
      </div>
    </template>

    <!-- ── EXERCISE PICKER ─────────────────────────────────────── -->
    <div v-if="pickerOpen" class="picker-backdrop" @click.self="pickerOpen = false">
      <div class="picker-sheet">
        <div class="picker-header">
          <span class="picker-title">ADD EXERCISE</span>
          <button class="picker-close" @click="pickerOpen = false">✕</button>
        </div>
        <div class="picker-search-row">
          <i class="pi pi-search search-icon" />
          <input v-model="pickerQuery" class="picker-search" placeholder="Search exercises..." autofocus />
        </div>
        <div class="picker-filters">
          <button
            v-for="bp in bodyParts" :key="bp"
            class="filter-chip"
            :class="{ active: selectedBodyPart === bp }"
            @click="selectedBodyPart = selectedBodyPart === bp ? null : bp"
          >{{ bp.replace('_',' ') }}</button>
        </div>
        <div class="picker-results">
          <div
            v-for="ex in pickerFiltered" :key="ex.id"
            class="picker-ex-row"
            @click="addExercise(ex)"
          >
            <div class="picker-ex-name">{{ ex.name }}</div>
            <div class="picker-ex-meta">{{ ex.body_part.replace('_',' ') }} · {{ ex.equipment }}</div>
          </div>
          <div v-if="pickerFiltered.length === 0" class="picker-empty">No exercises found</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute }      from 'vue-router'
import { VueDraggable }             from 'vue-draggable-plus'
import { useTemplateStore }  from '@/stores/templateStore'
import { useExerciseStore }  from '@/stores/exerciseStore'
import { useWorkoutStore }   from '@/stores/workoutStore'
import { useAuthStore }      from '@/stores/authStore'
import type { TemplateExerciseDocument } from '@/lib/rxdb/schemas'
import type { Exercise } from '@/stores/exerciseStore'

const router    = useRouter()
const route     = useRoute()
const templates = useTemplateStore()
const exercises = useExerciseStore()
const workout   = useWorkoutStore()
const auth      = useAuthStore()

const templateId = route.params.id as string

const template = computed(() => templates.templates.find(t => t.id === templateId) ?? null)
const isOwner  = computed(() =>
  !!(template.value && (template.value.owner_id === auth.user?.id || auth.isAdmin))
)

const templateName      = ref('')
const templateNotesDraft = ref('')

interface ExItem { te: TemplateExerciseDocument; name: string }
const items = ref<ExItem[]>([])

onMounted(async () => {
  exercises.subscribeToExercises()
  templateName.value       = template.value?.name ?? ''
  templateNotesDraft.value = template.value?.notes ?? ''
  await loadItems()
})

async function loadItems() {
  const tes = await templates.getTemplateExercises(templateId)
  items.value = tes.map(te => {
    const ex = exercises.exercises.find(e => e.id === te.exercise_id)
    return { te, name: ex?.name ?? te.exercise_id }
  })
}

async function saveName() {
  if (!templateName.value.trim()) return
  await templates.updateTemplate(templateId, { name: templateName.value.trim() })
}

async function saveNotes() {
  await templates.updateTemplate(templateId, { notes: templateNotesDraft.value.trim() || null })
}

async function togglePublish() {
  if (!template.value) return
  await templates.setPublic(templateId, !template.value.is_public)
}

// ── Field updates ─────────────────────────────────────────────────────────────

async function updateSets(teId: string, e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value)
  if (!isNaN(v) && v > 0) await templates.updateTemplateExercise(teId, { target_sets: v })
}

async function updateReps(teId: string, e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value)
  await templates.updateTemplateExercise(teId, { target_reps: isNaN(v) ? null : v })
}

async function updateRest(teId: string, e: Event) {
  const v = parseInt((e.target as HTMLSelectElement).value)
  await templates.updateTemplateExercise(teId, { rest_seconds: isNaN(v) ? null : v })
}

async function updateNotes(teId: string, e: Event) {
  const v = (e.target as HTMLInputElement).value.trim()
  await templates.updateTemplateExercise(teId, { notes: v || null })
}

// ── Drag reorder ──────────────────────────────────────────────────────────────

async function onDragEnd() {
  const ids = items.value.map(i => i.te.id)
  await templates.reorderTemplateExercises(templateId, ids)
}

// ── Remove exercise ───────────────────────────────────────────────────────────

async function removeExercise(teId: string) {
  await templates.removeExerciseFromTemplate(teId)
  await loadItems()
}

// ── Preview actions ───────────────────────────────────────────────────────────

async function startWorkout() {
  if (!template.value) return
  await workout.startSession(template.value.name, templateId)
  router.push('/workout/active')
}

async function handleDuplicate() {
  const newId = await templates.duplicateTemplate(templateId)
  router.push('/templates/' + newId)
}

function formatRest(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return s === 0 ? `${m}m` : `${m}m${s}s`
}

// ── Exercise picker ───────────────────────────────────────────────────────────

const pickerOpen       = ref(false)
const pickerQuery      = ref('')
const selectedBodyPart = ref<string | null>(null)
const bodyParts        = ['chest','back','shoulders','biceps','triceps','upper arms','quads','hamstrings','glutes','calves','waist','upper legs','lower legs']

const pickerFiltered = computed<Exercise[]>(() => {
  let list = exercises.exercises
  if (selectedBodyPart.value) list = list.filter(e => e.body_part === selectedBodyPart.value)
  if (pickerQuery.value.trim()) list = exercises.search(pickerQuery.value)
  return list
})

async function addExercise(ex: Exercise) {
  pickerOpen.value = false
  await templates.addExerciseToTemplate(templateId, ex.id)
  await loadItems()
}
</script>

<style scoped>
.view { background: #1C1C1E; min-height: 100dvh; color: #F0F0F0; font-family: 'DM Sans',sans-serif; padding-bottom: 5rem; }

/* Header */
.detail-header {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; gap: 0.6rem;
  background: #1C1C1E; border-bottom: 1px solid #252528;
  padding: 0.75rem 1rem;
}
.back-btn { background: none; border: none; color: #8E8E93; cursor: pointer; font-size: 1rem; padding: 0.25rem; flex-shrink: 0; }
.back-btn:active { color: #4A9EFF; }
.name-input {
  flex: 1; background: transparent; border: none; border-bottom: 1px solid #3A3A3C;
  color: #F0F0F0; font-family: 'Barlow Condensed',sans-serif; font-size: 1.1rem;
  font-weight: 800; letter-spacing: 0.05em; padding: 0.2rem 0;
}
.name-input:focus { outline: none; border-bottom-color: #4A9EFF; }
.name-display { flex: 1; font-family: 'Barlow Condensed',sans-serif; font-size: 1.1rem; font-weight: 800; color: #F0F0F0; }

.publish-btn {
  display: flex; align-items: center; gap: 0.3rem; flex-shrink: 0;
  background: #252528; border: 1px solid #3A3A3C; color: #636366;
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em;
  padding: 0.3rem 0.6rem; cursor: pointer; transition: all 0.15s;
}
.publish-btn.active { background: rgba(74,158,255,0.1); border-color: #4A9EFF; color: #4A9EFF; }
.publish-btn:active { border-color: #4A9EFF; color: #4A9EFF; }

/* Template notes */
.template-notes-row { padding: 0.6rem 1rem 0; }
.template-notes-input {
  width: 100%; background: transparent; border: none; border-bottom: 1px solid #252528;
  color: #8E8E93; font-family: 'DM Sans',sans-serif; font-size: 0.8rem;
  padding: 0.3rem 0; box-sizing: border-box;
}
.template-notes-input::placeholder { color: #636366; }
.template-notes-input:focus { outline: none; border-bottom-color: #3A3A3C; }
.template-notes-display { padding: 0.6rem 1rem; font-size: 0.8rem; color: #636366; }

/* ── Edit mode ──────────────────────────────────────────────────── */
.ex-list { padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.ex-item {
  display: flex; align-items: flex-start; gap: 0.5rem;
  background: #1C1C1E; border: 1px solid #252528; padding: 0.75rem;
  clip-path: polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%);
}
.drag-handle {
  color: #8E8E93; cursor: grab; padding: 0.25rem 0.1rem; flex-shrink: 0;
  touch-action: none; font-size: 0.85rem; margin-top: 0.15rem;
}
.drag-handle:active { color: #4A9EFF; cursor: grabbing; }

.ex-item-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.ex-item-name { font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 700; color: #F0F0F0; }

.ex-fields-row { display: flex; gap: 0.6rem; align-items: center; }
.mini-field { display: flex; align-items: center; gap: 0.35rem; }
.mini-label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.1em; color: #636366; }
.mini-input {
  width: 44px; background: #252528; border: 1px solid #3A3A3C;
  color: #F0F0F0; font-family: 'DM Sans',sans-serif; font-size: 0.85rem;
  padding: 0.2rem 0.3rem; text-align: center;
}
.mini-input:focus { outline: none; border-color: #4A9EFF; }
.mini-select {
  background: #252528; border: 1px solid #3A3A3C; color: #F0F0F0;
  font-family: 'DM Sans',sans-serif; font-size: 0.82rem;
  padding: 0.2rem 0.25rem; cursor: pointer;
}
.mini-select:focus { outline: none; border-color: #4A9EFF; }

.ex-note-input {
  width: 100%; background: transparent; border: none; border-bottom: 1px solid #252528;
  color: #AEAEB2; font-family: 'DM Sans',sans-serif; font-size: 0.78rem;
  padding: 0.2rem 0; box-sizing: border-box;
}
.ex-note-input::placeholder { color: #636366; }
.ex-note-input:focus { outline: none; border-bottom-color: #3A3A3C; color: #F0F0F0; }

.remove-btn { background: none; border: none; color: #636366; cursor: pointer; padding: 0.2rem; font-size: 0.75rem; flex-shrink: 0; margin-top: 0.1rem; }
.remove-btn:active { color: #FF4444; }

/* Empty */
.empty-state { text-align: center; padding: 3rem 1rem; color: #8E8E93; }
.empty-icon  { font-size: 2.5rem; color: #636366; display: block; margin-bottom: 0.75rem; }

/* Add exercise button */
.add-ex-btn {
  width: calc(100% - 2rem); margin: 0.75rem 1rem;
  background: #1C1C1E; border: 1px solid #3A3A3C; color: #8E8E93;
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; font-weight: 700; letter-spacing: 0.1em;
  padding: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  clip-path: polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);
  transition: border-color 0.15s, color 0.15s;
}
.add-ex-btn:active { border-color: #4A9EFF; color: #4A9EFF; }

/* ── Preview mode ───────────────────────────────────────────────── */
.preview-list { padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.preview-item {
  background: #1C1C1E; border: 1px solid #252528; padding: 0.85rem 0.9rem;
  clip-path: polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%);
}
.preview-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.preview-name { font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 700; color: #F0F0F0; }
.preview-targets { display: flex; gap: 0.35rem; flex-shrink: 0; }
.preview-tag {
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em;
  color: #4A9EFF; background: rgba(74,158,255,0.08); border: 1px solid rgba(74,158,255,0.2);
  padding: 0.1rem 0.4rem;
}
.preview-tag.rest-tag { color: #AEAEB2; background: rgba(255,255,255,0.03); border-color: #3A3A3C; }
.preview-note { font-size: 0.75rem; color: #636366; margin-top: 0.35rem; font-style: italic; }

.preview-actions { padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.start-btn {
  width: 100%; background: #4A9EFF; border: none; color: #fff;
  font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 800; letter-spacing: 0.12em;
  padding: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  clip-path: polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);
}
.start-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.dupe-btn {
  width: 100%; background: #1C1C1E; border: 1px solid #3A3A3C; color: #8E8E93;
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.1em;
  padding: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  transition: all 0.15s;
}
.dupe-btn:active { border-color: #FFB400; color: #FFB400; }

/* ── Exercise picker ─────────────────────────────────────────────── */
.picker-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.75);
  display: flex; align-items: flex-end;
}
.picker-sheet { width: 100%; background: #1C1C1E; border-top: 2px solid #4A9EFF; max-height: 85dvh; display: flex; flex-direction: column; }
.picker-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1rem 0.5rem; flex-shrink: 0; }
.picker-title { font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 800; color: #F0F0F0; letter-spacing: 0.1em; }
.picker-close { background: none; border: none; color: #636366; font-size: 1rem; cursor: pointer; }
.picker-close:active { color: #4A9EFF; }
.picker-search-row { position: relative; padding: 0 1rem 0.5rem; flex-shrink: 0; }
.search-icon { position: absolute; left: 1.75rem; top: 50%; transform: translateY(-50%); color: #8E8E93; font-size: 0.85rem; }
.picker-search { width: 100%; background: #252528; border: 1px solid #3A3A3C; color: #F0F0F0; font-family: 'DM Sans',sans-serif; font-size: 0.9rem; padding: 0.6rem 0.75rem 0.6rem 2.25rem; box-sizing: border-box; }
.picker-search:focus { outline: none; border-color: #4A9EFF; }
.picker-filters { display: flex; gap: 0.4rem; overflow-x: auto; padding: 0 1rem 0.6rem; scrollbar-width: none; flex-shrink: 0; }
.picker-filters::-webkit-scrollbar { display: none; }
.filter-chip { flex-shrink: 0; background: #252528; border: 1px solid #3A3A3C; color: #636366; font-family: 'Barlow Condensed',sans-serif; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.25rem 0.6rem; cursor: pointer; text-transform: uppercase; transition: all 0.15s; white-space: nowrap; }
.filter-chip.active { background: rgba(74,158,255,0.1); border-color: #4A9EFF; color: #4A9EFF; }
.picker-results { flex: 1; overflow-y: auto; padding: 0 1rem 1rem; }
.picker-ex-row { padding: 0.75rem 0; border-bottom: 1px solid #252528; cursor: pointer; }
.picker-ex-row:active { background: rgba(74,158,255,0.05); }
.picker-ex-name { font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 700; color: #F0F0F0; }
.picker-ex-meta { font-size: 0.7rem; color: #636366; margin-top: 0.1rem; text-transform: capitalize; }
.picker-empty { text-align: center; color: #8E8E93; padding: 2rem; font-size: 0.85rem; }
</style>
