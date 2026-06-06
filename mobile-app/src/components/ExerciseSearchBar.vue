<template>
  <div class="exercise-search-bar">
    <div class="search-field">
      <i class="pi pi-search search-icon" />
      <input
        class="search-input"
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        :placeholder="placeholder"
        :autofocus="autofocus"
      />
    </div>

    <div class="filters">
      <button
        v-for="bp in bodyParts" :key="bp"
        class="filter-chip"
        :class="{ active: bodyPart === bp }"
        @click="$emit('update:bodyPart', bodyPart === bp ? null : bp)"
      >{{ bp.replace('_', ' ') }}</button>
    </div>

    <div v-if="equipmentList?.length" class="filters eq-filters">
      <button
        v-for="eq in equipmentList" :key="eq"
        class="filter-chip eq-chip"
        :class="{ active: equipment === eq }"
        @click="$emit('update:equipment', equipment === eq ? null : eq)"
      >{{ eq }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: string
  bodyParts: string[]
  bodyPart: string | null
  equipmentList?: string[]
  equipment?: string | null
  placeholder?: string
  autofocus?: boolean
}>(), {
  placeholder: 'Search...',
  autofocus: false,
})

defineEmits<{
  'update:modelValue': [value: string]
  'update:bodyPart':   [value: string | null]
  'update:equipment':  [value: string | null]
}>()
</script>

<style scoped>
.search-field { position: relative; margin-bottom: 0.75rem; }
.search-icon  { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #8E8E93; font-size: 0.85rem; }
.search-input { width: 100%; background: #1C1C1E; border: 1px solid #3A3A3C; color: #F0F0F0; font-family: 'DM Sans', sans-serif; font-size: 0.9rem; padding: 0.65rem 0.75rem 0.65rem 2.25rem; }
.search-input:focus { outline: none; border-color: #4A9EFF; }
.filters { display: flex; gap: 0.4rem; overflow-x: auto; padding-bottom: 0.75rem; scrollbar-width: none; }
.filters::-webkit-scrollbar { display: none; }
.eq-filters { padding-bottom: 0.5rem; }
.eq-chip { font-size: 0.65rem !important; padding: 0.2rem 0.55rem !important; }
.filter-chip { flex-shrink: 0; background: #1C1C1E; border: 1px solid #3A3A3C; color: #636366; font-family: 'Barlow Condensed', sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.3rem 0.7rem; cursor: pointer; text-transform: uppercase; transition: all 0.15s; white-space: nowrap; }
.filter-chip.active { background: rgba(74,158,255,0.1); border-color: #4A9EFF; color: #4A9EFF; }
</style>
