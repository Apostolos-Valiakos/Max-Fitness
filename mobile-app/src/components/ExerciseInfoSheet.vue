<template>
  <Teleport to="body">
    <div v-if="visible && exercise" class="info-backdrop" @click.self="$emit('close')">
      <div class="info-sheet">
        <!-- Handle bar -->
        <div class="sheet-handle" @click="$emit('close')" />

        <!-- Header -->
        <div class="sheet-header">
          <div class="sheet-title">{{ exercise.name }}</div>
          <button class="sheet-close" @click="$emit('close')"><i class="pi pi-times" /></button>
        </div>

        <!-- Chips -->
        <div class="chips-row">
          <span class="chip bp">{{ exercise.body_part.replace('_', ' ') }}</span>
          <span class="chip eq">{{ exercise.equipment }}</span>
          <span v-if="exercise.target_muscle" class="chip target">{{ exercise.target_muscle }}</span>
        </div>

        <!-- Scrollable content -->
        <div class="sheet-body">
          <!-- Animation (cross-fades 2 frames for static datasets, passes through for real GIFs) -->
          <div v-if="exercise.image_url" class="gif-wrap">
            <ExerciseAnimation :imageUrl="exercise.image_url" :alt="exercise.name" />
          </div>

          <!-- Secondary muscles -->
          <div v-if="exercise.secondary_muscles?.length" class="section">
            <div class="section-label">SECONDARY MUSCLES</div>
            <div class="muscle-chips">
              <span v-for="m in exercise.secondary_muscles" :key="m" class="muscle-chip">{{ m }}</span>
            </div>
          </div>

          <!-- Instructions -->
          <div v-if="instructionSteps.length" class="section">
            <div class="section-label">HOW TO PERFORM</div>
            <ol class="steps">
              <li v-for="(step, i) in instructionSteps" :key="i" class="step">
                <span class="step-num">{{ i + 1 }}</span>
                <span class="step-text">{{ step }}</span>
              </li>
            </ol>
          </div>

          <div v-if="!exercise.image_url && !instructionSteps.length" class="no-info">
            No additional information available.
          </div>
        </div>

        <!-- Open full detail -->
        <button class="detail-btn" @click="openDetail">
          VIEW FULL STATS <i class="pi pi-arrow-right" />
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getDatabase } from '@/lib/rxdb/database'
import type { ExerciseDocument } from '@/lib/rxdb/schemas'
import ExerciseAnimation from '@/components/ExerciseAnimation.vue'

const props = defineProps<{
  visible: boolean
  exerciseId: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const router   = useRouter()
const exercise = ref<ExerciseDocument | null>(null)

watch(
  () => props.exerciseId,
  async (id) => {
    if (!id) { exercise.value = null; return }
    const db  = getDatabase()
    const doc = await db.exercises.findOne(id).exec()
    exercise.value = doc ? doc.toJSON() : null
  },
  { immediate: true },
)

const instructionSteps = computed(() => {
  if (!exercise.value?.instructions) return []
  return exercise.value.instructions.split('\n').filter(Boolean)
})

function openDetail() {
  if (!exercise.value) return
  emit('close')
  router.push('/exercises/' + exercise.value.id)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap');

.info-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: flex-end; justify-content: center;
}

.info-sheet {
  width: 100%; max-width: 520px;
  background: #111; border-top: 2px solid #FF4D00;
  max-height: 88dvh;
  display: flex; flex-direction: column;
}

.sheet-handle {
  width: 36px; height: 4px; background: #333; border-radius: 2px;
  margin: 0.6rem auto 0; cursor: pointer; flex-shrink: 0;
}

.sheet-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 0.75rem 1rem 0.5rem; flex-shrink: 0;
}

.sheet-title {
  font-family: 'Barlow Condensed',sans-serif; font-size: 1.4rem; font-weight: 900;
  color: #F0F0F0; line-height: 1.1; flex: 1; text-transform: uppercase;
}

.sheet-close {
  background: none; border: none; color: #555; cursor: pointer;
  font-size: 0.85rem; padding: 0.1rem; flex-shrink: 0;
}

.chips-row {
  display: flex; flex-wrap: wrap; gap: 0.3rem;
  padding: 0 1rem 0.75rem; flex-shrink: 0;
}

.chip {
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.65rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: capitalize;
  padding: 0.2rem 0.5rem; border: 1px solid;
}

.chip.bp     { color: #666; border-color: #2A2A2A; background: #1A1A1A; }
.chip.eq     { color: #555; border-color: #222; background: #161616; }
.chip.target { color: #FF4D00; border-color: rgba(255,77,0,0.3); background: rgba(255,77,0,0.06); }

.sheet-body {
  flex: 1; overflow-y: auto; padding: 0 1rem 0.5rem;
}

.gif-wrap {
  width: 100%; background: #0A0A0A; border: 1px solid #1A1A1A;
  margin-bottom: 1rem; display: flex; justify-content: center; overflow: hidden;
}

.ex-gif {
  max-height: 260px; width: auto; max-width: 100%;
  object-fit: contain; display: block;
}

.section { margin-bottom: 1.25rem; }

.section-label {
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.62rem; font-weight: 700;
  letter-spacing: 0.2em; color: #777; margin-bottom: 0.5rem;
}

.muscle-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }

.muscle-chip {
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.68rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: capitalize;
  padding: 0.2rem 0.55rem; border: 1px solid #2A2A2A; color: #888; background: #1A1A1A;
}

.steps { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.6rem; }

.step {
  display: flex; align-items: flex-start; gap: 0.6rem;
  font-size: 0.82rem; color: #999; line-height: 1.5;
}

.step-num {
  font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 900;
  color: #FF4D00; min-width: 1.4rem; flex-shrink: 0; line-height: 1.3;
}

.step-text { flex: 1; }

.no-info { color: #777; font-size: 0.8rem; text-align: center; padding: 2rem 0; }

.detail-btn {
  width: 100%; background: transparent; border: none; border-top: 1px solid #1A1A1A;
  color: #555; font-family: 'Barlow Condensed',sans-serif; font-size: 0.8rem;
  font-weight: 700; letter-spacing: 0.12em; padding: 0.9rem;
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  transition: color 0.15s; flex-shrink: 0;
}

.detail-btn:active { color: #FF4D00; }
</style>
