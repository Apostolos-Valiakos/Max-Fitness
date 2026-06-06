<template>
  <div class="ex-card" @click="$emit('click')">
    <div class="ex-icon">{{ exercise.name[0] }}</div>
    <div class="ex-body">
      <div class="ex-name">{{ exercise.name }}</div>
      <div class="ex-meta">
        <span class="ex-chip">{{ exercise.body_part.replace("_", " ") }}</span>
        <span class="ex-chip">{{ exercise.equipment }}</span>
        <span v-if="exercise.image_url" class="ex-chip photo"
          ><i class="pi pi-image" /> photo</span
        >
        <span v-if="exercise.is_custom" class="ex-chip custom">Custom</span>
      </div>
    </div>
    <div class="ex-right">
      <span v-if="usageCount" class="usage-badge">{{ usageCount }}</span>
      <i v-if="showArrow" class="pi pi-chevron-right ex-arrow" />
      <button v-if="showAdd" class="ex-add" @click.stop="$emit('add')">
        <i class="pi pi-plus" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ExerciseDocument } from "@/lib/rxdb/schemas";
defineProps<{
  exercise: ExerciseDocument;
  showArrow?: boolean;
  showAdd?: boolean;
  usageCount?: number;
}>();
defineEmits<{ click: []; add: [] }>();
</script>

<style scoped>
.ex-card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  background: #1c1c1e;
  border: 1px solid var(--surface);
  padding: 0.9rem 1rem;
  cursor: pointer;
  transition: border-color 0.2s;
}
.ex-card:active {
  border-color: #4a9eff;
}
.ex-icon {
  width: 38px;
  height: 38px;
  background: rgba(74, 158, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 900;
  font-size: 1.1rem;
  color: #4a9eff;
  flex-shrink: 0;
}
.ex-body {
  flex: 1;
  min-width: 0;
}
.ex-name {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 1rem;
  font-weight: 700;
  color: #f0f0f0;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ex-meta {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}
.ex-chip {
  background: var(--surface);
  border: 1px solid #3a3a3c;
  padding: 0.15rem 0.4rem;
  font-size: 0.62rem;
  color: #8e8e93;
  text-transform: capitalize;
}
.ex-chip.custom {
  color: #4a9eff;
  border-color: rgba(74, 158, 255, 0.3);
}
.ex-chip.photo {
  color: #4488ff;
  border-color: rgba(68, 136, 255, 0.25);
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}
.ex-chip.photo .pi {
  font-size: 0.58rem;
}
.ex-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}
.usage-badge {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid #3a3a3c;
  padding: 0.1rem 0.4rem;
  min-width: 1.4rem;
  text-align: center;
}
.ex-arrow {
  color: #8e8e93;
  font-size: 0.75rem;
}
.ex-add {
  width: 32px;
  height: 32px;
  background: #4a9eff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s;
}
.ex-add:active {
  background: #3b8eef;
}
.ex-add i {
  font-size: 0.8rem;
}
</style>
