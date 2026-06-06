<template>
  <header class="view-header" :style="headerStyle">
    <button v-if="back" class="back-btn" @click="router.back()">
      <i class="pi" :class="backIcon" />
    </button>
    <h1 class="view-title" :style="{ fontSize: titleSize + 'rem' }"><slot>{{ title }}</slot></h1>
    <slot name="right" />
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = withDefaults(defineProps<{
  title?: string
  back?: boolean
  backIcon?: string
  mb?: string
  titleSize?: number
  padded?: boolean
}>(), {
  back: false,
  backIcon: 'pi-arrow-left',
  mb: '1.5rem',
  titleSize: 1.8,
  padded: false,
})

const router = useRouter()

const headerStyle = computed(() => props.padded
  ? { padding: '1.25rem 1rem 0.75rem' }
  : { marginBottom: props.mb }
)
</script>

<style scoped>
.view-header { display: flex; align-items: center; gap: 1rem; }
.back-btn    { background: none; border: none; color: var(--sub); cursor: pointer; font-size: 1rem; padding: 0; flex-shrink: 0; }
.view-title  { font-family: 'Barlow Condensed', sans-serif; font-weight: 900; letter-spacing: 0.03em; flex: 1; }
</style>
