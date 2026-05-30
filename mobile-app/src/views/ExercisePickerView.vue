<template>
  <div class="view">
    <div class="picker-header">
      <button class="back-btn" @click="router.back()"><i class="pi pi-times" /></button>
      <h1 class="view-title">{{ replaceId ? 'REPLACE EXERCISE' : 'ADD EXERCISE' }}</h1>
    </div>

    <div class="search-bar">
      <i class="pi pi-search search-icon" />
      <input v-model="query" class="search-input" placeholder="Search exercises..." autofocus />
    </div>

    <!-- Filters -->
    <div class="filters">
      <button
        v-for="bp in bodyParts" :key="bp"
        class="filter-chip"
        :class="{ active: selectedBodyPart === bp }"
        @click="selectedBodyPart = selectedBodyPart === bp ? null : bp"
      >{{ bp.replace('_',' ') }}</button>
    </div>

    <!-- Results -->
    <div class="results">
      <ExerciseCard
        v-for="ex in filtered" :key="ex.id"
        :exercise="ex"
        :showAdd="true"
        @add="handleAdd(ex)"
      />
      <div v-if="filtered.length === 0" class="empty">No exercises found</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useWorkoutStore }  from '@/stores/workoutStore'
import { useExerciseStore } from '@/stores/exerciseStore'
import ExerciseCard from '@/components/ExerciseCard.vue'
import type { ExerciseDocument } from '@/lib/rxdb/schemas'

const router    = useRouter()
const route     = useRoute()
const workout   = useWorkoutStore()
const exercises = useExerciseStore()

const query           = ref('')
const selectedBodyPart = ref<string | null>(null)

// Replace mode: replaceId query param means swap instead of add
const replaceId = computed(() => route.query.replaceId as string | undefined)

const bodyParts = ['chest','back','shoulders','biceps','triceps','quads','hamstrings','glutes','calves','core','full_body']

const filtered = computed(() => {
  let list = exercises.exercises
  if (selectedBodyPart.value) list = list.filter(e => e.body_part === selectedBodyPart.value)
  if (query.value.trim()) list = exercises.search(query.value)
  return list
})

onMounted(() => exercises.subscribeToExercises())

async function handleAdd(ex: ExerciseDocument) {
  if (replaceId.value) {
    await workout.replaceExercise(replaceId.value, ex.id, ex.name)
  } else {
    workout.addExercise(ex.id, ex.name)
  }
  router.back()
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap');
.view { background: #0A0A0A; min-height: 100dvh; color: #F0F0F0; font-family: 'DM Sans',sans-serif; }
.picker-header { display: flex; align-items: center; gap: 1rem; padding: 1.25rem 1rem 0.75rem; }
.back-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 1rem; }
.view-title { font-family: 'Barlow Condensed',sans-serif; font-size: 1.2rem; font-weight: 900; letter-spacing: 0.05em; }
.search-bar { position: relative; margin: 0 1rem 0.75rem; }
.search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #777; font-size: 0.85rem; }
.search-input { width: 100%; background: #111; border: 1px solid #2A2A2A; color: #F0F0F0; font-family: 'DM Sans',sans-serif; font-size: 0.9rem; padding: 0.65rem 0.75rem 0.65rem 2.25rem; }
.search-input:focus { outline: none; border-color: #FF4D00; }
.filters { display: flex; gap: 0.4rem; overflow-x: auto; padding: 0 1rem 0.75rem; scrollbar-width: none; }
.filters::-webkit-scrollbar { display: none; }
.filter-chip { flex-shrink: 0; background: #111; border: 1px solid #2A2A2A; color: #555; font-family: 'Barlow Condensed',sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.3rem 0.7rem; cursor: pointer; text-transform: uppercase; transition: all 0.15s; white-space: nowrap; }
.filter-chip.active { background: rgba(255,77,0,0.1); border-color: #FF4D00; color: #FF4D00; }
.results { display: flex; flex-direction: column; gap: 1px; padding: 0 1rem; }
.empty { text-align: center; color: #777; padding: 2rem; font-size: 0.85rem; }
</style>
