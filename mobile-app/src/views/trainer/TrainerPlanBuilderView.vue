<template>
  <div class="view">
    <div class="view-header">
      <button class="back-btn" @click="router.back()"><i class="pi pi-arrow-left" /></button>
      <h1 class="view-title">WORKOUT PLANS</h1>
      <button class="add-plan-btn" @click="showCreateModal = true"><i class="pi pi-plus" /></button>
    </div>

    <div v-if="trainer.plans.length === 0" class="empty-state">
      <i class="pi pi-list empty-icon" />
      <p>No plans yet.</p>
      <button class="cta-btn" @click="showCreateModal = true">Create your first plan</button>
    </div>

    <div v-else class="plan-list">
      <div v-for="plan in trainer.plans" :key="plan.id" class="plan-card">
        <!-- Plan header -->
        <div class="plan-header">
          <div class="plan-info">
            <div class="plan-name">{{ plan.name }}</div>
            <div class="plan-desc" v-if="plan.description">{{ plan.description }}</div>
          </div>
          <button class="plan-delete" @click="handleDeletePlan(plan.id)"><i class="pi pi-trash" /></button>
        </div>

        <!-- Weekly grid -->
        <div class="weekly-grid">
          <div v-for="day in DAYS" :key="day.dow" class="day-slot">
            <div class="day-label">{{ day.short }}</div>
            <div
              v-if="getDayTemplate(plan, day.dow)"
              class="day-assigned"
              @click="openDayPicker(plan.id, day.dow)"
            >
              <span class="day-tmpl-name">{{ getDayTemplate(plan, day.dow)?.template_name }}</span>
              <button class="day-clear" @click.stop="trainer.setPlanDay(plan.id, day.dow, null)">
                <i class="pi pi-times" />
              </button>
            </div>
            <button v-else class="day-add" @click="openDayPicker(plan.id, day.dow)">
              <i class="pi pi-plus" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create plan modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">NEW PLAN</div>
          <button class="modal-close" @click="showCreateModal = false"><i class="pi pi-times" /></button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label class="field-label">PLAN NAME</label>
            <input v-model="newName" class="field-input" placeholder="e.g. 3-Day Push Pull Legs" />
          </div>
          <div class="field">
            <label class="field-label">DESCRIPTION (optional)</label>
            <input v-model="newDesc" class="field-input" placeholder="Brief description…" />
          </div>
          <div v-if="createError" class="form-error">{{ createError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showCreateModal = false">Cancel</button>
          <button class="btn-create" @click="handleCreate" :disabled="!newName.trim() || creating">
            {{ creating ? 'Creating…' : 'CREATE' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Template picker for a day -->
    <div v-if="pickerState" class="modal-overlay" @click.self="pickerState = null">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">PICK TEMPLATE — {{ DAYS[pickerState.dow === 0 ? 6 : pickerState.dow - 1]?.label ?? '' }}</div>
          <button class="modal-close" @click="pickerState = null"><i class="pi pi-times" /></button>
        </div>
        <div class="modal-body picker-list">
          <div v-if="myTemplates.length === 0" class="tab-empty">No templates yet.</div>
          <div
            v-for="t in myTemplates"
            :key="t.id"
            class="picker-row"
            @click="handlePickTemplate(t.id)"
          >
            {{ t.name }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTrainerStore } from '@/stores/trainerStore'
import { supabase } from '@/lib/supabase'
import type { WorkoutPlan } from '@/stores/trainerStore'

const router  = useRouter()
const trainer = useTrainerStore()
const myTemplates = ref<{ id: string; name: string }[]>([])

const DAYS = [
  { dow: 1, short: 'MON', label: 'Monday' },
  { dow: 2, short: 'TUE', label: 'Tuesday' },
  { dow: 3, short: 'WED', label: 'Wednesday' },
  { dow: 4, short: 'THU', label: 'Thursday' },
  { dow: 5, short: 'FRI', label: 'Friday' },
  { dow: 6, short: 'SAT', label: 'Saturday' },
  { dow: 0, short: 'SUN', label: 'Sunday' },
]

const showCreateModal = ref(false)
const newName  = ref('')
const newDesc  = ref('')
const creating = ref(false)
const createError = ref('')
const pickerState = ref<{ planId: string; dow: number } | null>(null)

function getDayTemplate(plan: WorkoutPlan, dow: number) {
  return plan.days.find(d => d.day_of_week === dow)
}

function openDayPicker(planId: string, dow: number) {
  pickerState.value = { planId, dow }
}

async function handlePickTemplate(templateId: string) {
  if (!pickerState.value) return
  await trainer.setPlanDay(pickerState.value.planId, pickerState.value.dow, templateId)
  pickerState.value = null
}

async function handleCreate() {
  if (!newName.value.trim()) return
  creating.value = true; createError.value = ''
  const plan = await trainer.createPlan(newName.value.trim(), newDesc.value.trim() || undefined)
  creating.value = false
  if (!plan) { createError.value = 'Failed to create plan.'; return }
  newName.value = ''; newDesc.value = ''
  showCreateModal.value = false
}

async function handleDeletePlan(id: string) {
  await trainer.deletePlan(id)
}

onMounted(async () => {
  await trainer.fetchPlans()
  const { data } = await supabase
    .from('workout_templates')
    .select('id, name')
    .is('assigned_by', null)
    .order('name')
  myTemplates.value = data ?? []
})
</script>

<style scoped>
.view { padding: 0 0 100px; }
.view-header { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; border-bottom: 1px solid #252528; }
.back-btn { background: none; border: none; color: #AEAEB2; cursor: pointer; font-size: 1.1rem; }
.view-title { flex: 1; font-family: 'Barlow Condensed', sans-serif; font-size: 1.4rem; font-weight: 900; color: #F0F0F0; letter-spacing: 0.05em; }
.add-plan-btn { background: #4A9EFF; border: none; color: #fff; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1rem; }

.empty-state { text-align: center; padding: 4rem 2rem; color: #8E8E93; }
.empty-icon  { font-size: 2.5rem; color: #636366; display: block; margin-bottom: 1rem; }
.cta-btn { margin-top: 1rem; background: #4A9EFF; border: none; color: #fff; padding: 0.6rem 1.25rem; font-family: 'Barlow Condensed', sans-serif; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; }

.plan-list { display: flex; flex-direction: column; gap: 1px; padding: 0.75rem 0; }
.plan-card { background: #1C1C1E; border: 1px solid #252528; margin: 0 0.75rem 0.75rem; }

.plan-header { display: flex; align-items: flex-start; padding: 0.875rem; border-bottom: 1px solid #252528; }
.plan-info { flex: 1; }
.plan-name { font-family: 'Barlow Condensed', sans-serif; font-size: 1.05rem; font-weight: 800; color: #F0F0F0; }
.plan-desc { font-size: 0.72rem; color: #636366; margin-top: 0.2rem; }
.plan-delete { background: none; border: none; color: #3A3A3C; cursor: pointer; padding: 0.25rem; font-size: 0.9rem; }
.plan-delete:hover { color: #4A9EFF; }

.weekly-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; padding: 0.75rem; }
.day-slot { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.day-label { font-family: 'Barlow Condensed', sans-serif; font-size: 0.58rem; font-weight: 700; color: #8E8E93; letter-spacing: 0.05em; text-align: center; }

.day-add {
  width: 100%; aspect-ratio: 1; border: 1px dashed #3A3A3C; background: #1C1C1E;
  color: #8E8E93; display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 0.7rem; transition: border-color 0.15s, color 0.15s;
}
.day-add:hover { border-color: #4A9EFF; color: #4A9EFF; }

.day-assigned {
  width: 100%; min-height: 36px; background: rgba(74,158,255,0.12); border: 1px solid rgba(74,158,255,0.3);
  padding: 3px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  cursor: pointer; position: relative;
}
.day-tmpl-name { font-size: 0.5rem; color: #4A9EFF; text-align: center; line-height: 1.2; word-break: break-word; }
.day-clear {
  background: none; border: none; color: rgba(74,158,255,0.5); cursor: pointer;
  font-size: 0.55rem; padding: 0; margin-top: 2px;
}
.day-clear:hover { color: #4A9EFF; }

/* Modal shared */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: flex-end; }
.modal { width: 100%; background: #1C1C1E; border-top: 1px solid #3A3A3C; max-height: 80vh; overflow-y: auto; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem; border-bottom: 1px solid #252528; }
.modal-title { font-family: 'Barlow Condensed', sans-serif; font-size: 1rem; font-weight: 800; color: #F0F0F0; letter-spacing: 0.08em; }
.modal-close { background: none; border: none; color: #636366; cursor: pointer; }
.modal-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.875rem; }
.modal-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0.75rem 1rem; border-top: 1px solid #252528; }

.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field-label { font-family: 'Barlow Condensed', sans-serif; font-size: 0.62rem; font-weight: 700; color: #636366; letter-spacing: 0.12em; }
.field-input { background: #1C1C1E; border: 1px solid #3A3A3C; color: #EBEBEB; padding: 0.6rem 0.75rem; font-size: 0.875rem; font-family: 'DM Sans', sans-serif; }
.form-error { font-size: 0.75rem; color: #4A9EFF; }

.btn-cancel { background: none; border: 1px solid #3A3A3C; color: #636366; padding: 0.5rem 0.875rem; font-family: 'Barlow Condensed', sans-serif; font-size: 0.8rem; cursor: pointer; }
.btn-create { background: #4A9EFF; border: none; color: #fff; padding: 0.5rem 1rem; font-family: 'Barlow Condensed', sans-serif; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; }
.btn-create:disabled { opacity: 0.4; cursor: not-allowed; }

.picker-list { max-height: 50vh; overflow-y: auto; display: flex; flex-direction: column; }
.picker-row { padding: 0.875rem; border-bottom: 1px solid #252528; cursor: pointer; color: #EBEBEB; font-size: 0.9rem; }
.picker-row:hover { background: #252528; color: #4A9EFF; }
</style>
