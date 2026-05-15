<template>
  <div class="session-card" @click="$emit('click')">
    <div class="card-header">
      <div class="card-date">{{ formattedDate }}</div>
      <div class="card-duration" v-if="duration">{{ duration }}</div>
    </div>
    <div class="card-name">{{ session.name }}</div>
    <div class="card-exercises">
      <span v-for="name in exerciseNames.slice(0,4)" :key="name" class="exercise-chip">{{ name }}</span>
      <span v-if="exerciseNames.length > 4" class="exercise-chip more">+{{ exerciseNames.length - 4 }}</span>
    </div>
    <div class="card-footer">
      <span class="card-vol">{{ totalVolume > 0 ? Math.round(totalVolume).toLocaleString() + ' kg total' : '' }}</span>
      <i class="pi pi-chevron-right card-arrow" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { format } from 'date-fns'
import type { WorkoutSessionDocument } from '@/lib/rxdb/schemas'

const props = defineProps<{
  session: WorkoutSessionDocument
  exerciseNames: string[]
  totalVolume: number
}>()
defineEmits<{ click: [] }>()

const formattedDate = computed(() => format(new Date(props.session.started_at), 'EEE, MMM d'))
const duration = computed(() => {
  if (!props.session.finished_at) return null
  const secs = Math.floor((new Date(props.session.finished_at).getTime() - new Date(props.session.started_at).getTime()) / 1000)
  const m = Math.floor(secs / 60); const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
})
</script>

<style scoped>
.session-card {
  background: #111; border: 1px solid #1A1A1A; padding: 1.25rem;
  cursor: pointer; transition: border-color 0.2s;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%);
}
.session-card:active { border-color: #FF4D00; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }
.card-date { font-size: 0.72rem; color: #666; text-transform: uppercase; letter-spacing: 0.1em; }
.card-duration { font-size: 0.72rem; color: #444; }
.card-name { font-family: 'Barlow Condensed', sans-serif; font-size: 1.2rem; font-weight: 700; color: #F0F0F0; margin-bottom: 0.6rem; }
.card-exercises { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.75rem; }
.exercise-chip { background: #1A1A1A; border: 1px solid #2A2A2A; padding: 0.2rem 0.5rem; font-size: 0.68rem; color: #888; }
.exercise-chip.more { color: #FF4D00; border-color: #FF4D00; }
.card-footer { display: flex; justify-content: space-between; align-items: center; }
.card-vol { font-size: 0.72rem; color: #555; }
.card-arrow { color: #333; font-size: 0.75rem; }
</style>
