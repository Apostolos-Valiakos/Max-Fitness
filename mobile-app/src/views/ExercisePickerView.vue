<template>
  <div class="view">
    <ViewHeader :title="replaceId ? 'REPLACE EXERCISE' : 'ADD EXERCISE'" back backIcon="pi-times" :titleSize="1.2" padded />

    <ExerciseSearchBar
      v-model="query"
      v-model:bodyPart="selectedBodyPart"
      :bodyParts="bodyParts"
      placeholder="Search exercises..."
      autofocus
      class="search-padded"
    />

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
import ViewHeader from '@/components/ViewHeader.vue'
import { useWorkoutStore }  from '@/stores/workoutStore'
import { useExerciseStore } from '@/stores/exerciseStore'
import ExerciseCard from '@/components/ExerciseCard.vue'
import ExerciseSearchBar from '@/components/ExerciseSearchBar.vue'
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
.view { background: #1C1C1E; min-height: 100dvh; color: #F0F0F0; font-family: 'DM Sans',sans-serif; }
.search-padded { padding: 0 1rem; }
.results { display: flex; flex-direction: column; gap: 1px; padding: 0 1rem; }
.empty { text-align: center; color: #8E8E93; padding: 2rem; font-size: 0.85rem; }
</style>
