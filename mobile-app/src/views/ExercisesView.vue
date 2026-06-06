<template>
  <div class="view">
    <ViewHeader title="EXERCISES" mb="1rem">
      <template #right>
        <button class="add-btn" @click="showCreate = true"><i class="pi pi-plus" /></button>
      </template>
    </ViewHeader>

    <ExerciseSearchBar
      v-model="query"
      v-model:bodyPart="selectedBP"
      v-model:equipment="selectedEQ"
      :bodyParts="bodyParts"
      :equipmentList="equipmentList"
    />

    <!-- Alphabetical groups -->
    <div class="results">
      <template v-for="[letter, group] in groupedExercises" :key="letter">
        <div class="alpha-header">{{ letter }}</div>
        <ExerciseCard
          v-for="ex in group" :key="ex.id"
          :exercise="ex"
          :showArrow="true"
          :usageCount="usageCounts[ex.id] ?? 0"
          @click="router.push('/exercises/'+ex.id)"
        />
      </template>
      <div v-if="groupedExercises.length === 0" class="empty">No exercises found</div>
    </div>

    <!-- Create custom exercise dialog -->
    <Dialog v-model:visible="showCreate" modal header="NEW EXERCISE" :style="{ width: '92vw', maxWidth: '400px' }" class="mf-dialog">
      <div class="create-form">
        <div class="field"><label>NAME</label><InputText v-model="newName" class="mf-input" placeholder="e.g. Pendlay Row" /></div>
        <div class="field">
          <label>MUSCLE GROUP</label>
          <select v-model="newBodyPart" class="mf-select">
            <option v-for="bp in bodyParts" :key="bp" :value="bp">{{ bp.replace('_',' ') }}</option>
          </select>
        </div>
        <div class="field">
          <label>EQUIPMENT</label>
          <select v-model="newEquipment" class="mf-select">
            <option v-for="eq in equipmentList" :key="eq" :value="eq">{{ eq }}</option>
          </select>
        </div>
        <div class="dialog-actions">
          <button class="dialog-btn cancel" @click="showCreate = false">Cancel</button>
          <button class="dialog-btn finish" :disabled="!newName" @click="handleCreate">Create</button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ViewHeader from '@/components/ViewHeader.vue'
import Dialog    from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useExerciseStore } from '@/stores/exerciseStore'
import { getDatabase }      from '@/lib/rxdb/database'
import ExerciseCard from '@/components/ExerciseCard.vue'
import ExerciseSearchBar from '@/components/ExerciseSearchBar.vue'

const router    = useRouter()
const exercises = useExerciseStore()

const query      = ref('')
const selectedBP = ref<string | null>(null)
const selectedEQ = ref<string | null>(null)
const showCreate = ref(false)
const newName      = ref('')
const newBodyPart  = ref('chest')
const newEquipment = ref('barbell')
const usageCounts  = ref<Record<string, number>>({})

const bodyParts     = ['chest','back','shoulders','biceps','triceps','forearms','quads','hamstrings','glutes','calves','core','full_body']
const equipmentList = ['barbell','dumbbell','cable','machine','bodyweight','kettlebell','band','other']

const filtered = computed(() => {
  let list = exercises.exercises
  if (selectedBP.value) list = list.filter(e => e.body_part === selectedBP.value)
  if (selectedEQ.value) list = list.filter(e => e.equipment === selectedEQ.value)
  if (query.value.trim()) list = list.filter(e => e.name.toLowerCase().includes(query.value.toLowerCase()))
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
})

const groupedExercises = computed((): [string, typeof filtered.value][] => {
  const groups = new Map<string, typeof filtered.value>()
  for (const ex of filtered.value) {
    const letter = ex.name[0]?.toUpperCase() ?? '#'
    if (!groups.has(letter)) groups.set(letter, [])
    groups.get(letter)!.push(ex)
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
})

onMounted(async () => {
  exercises.subscribeToExercises()
  await loadUsageCounts()
})

async function loadUsageCounts() {
  const db = getDatabase()
  const sets = await db.sets.find({}).exec()
  const counts: Record<string, number> = {}
  for (const s of sets) {
    const d = s.toJSON()
    counts[d.exercise_id] = (counts[d.exercise_id] ?? 0) + 1
  }
  usageCounts.value = counts
}

async function handleCreate() {
  await exercises.createCustomExercise({ name: newName.value, body_part: newBodyPart.value as any, equipment: newEquipment.value as any })
  showCreate.value = false; newName.value = ''
}
</script>

<style scoped>
.view { padding: 1.5rem 1rem 0; color: #F0F0F0; font-family: 'DM Sans',sans-serif; background: #1C1C1E; min-height: 100vh; }
.add-btn { background: #4A9EFF; border: none; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; clip-path: polygon(0 0,100% 0,100% 75%,85% 100%,0 100%); }
.results { display: flex; flex-direction: column; gap: 1px; }
.alpha-header { font-family: 'Barlow Condensed',sans-serif; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.2em; color: #8E8E93; padding: 0.6rem 0 0.25rem; border-bottom: 1px solid #252528; margin-bottom: 1px; }
.empty { text-align: center; color: #8E8E93; padding: 2rem; font-size: 0.85rem; }

.create-form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.2em; color: #636366; }
.mf-select { width: 100%; background: #252528; border: 1px solid #3A3A3C; color: #F0F0F0; font-family: 'DM Sans',sans-serif; font-size: 0.9rem; padding: 0.65rem 0.75rem; cursor: pointer; }
.mf-select:focus { outline: none; border-color: #4A9EFF; }
.dialog-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.dialog-btn { flex: 1; border: none; font-family: 'Barlow Condensed',sans-serif; font-weight: 700; letter-spacing: 0.1em; font-size: 0.9rem; padding: 0.75rem; cursor: pointer; }
.dialog-btn.cancel { background: #252528; color: #AEAEB2; }
.dialog-btn.finish { background: #4A9EFF; color: #fff; clip-path: polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%); }
.dialog-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
