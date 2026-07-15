<template>
  <svg viewBox="0 0 100 100" :width="size" :height="size" aria-hidden="true">
    <polygon points="14,58 34,58 34,80 24,90 14,90" :fill="barFill" />
    <polygon points="40,38 60,38 60,80 50,90 40,90" :fill="barFill" />
    <polygon points="66,16 86,16 86,80 76,90 66,90" :fill="peakFill" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: number | string
  /** 'color' = blue bars + gold peak (default) · 'mono' = single flat color for all three bars */
  variant?: 'color' | 'mono'
  monoColor?: string
}>(), {
  size: 28,
  variant: 'color',
  monoColor: '#F0F0F0',
})

const barFill  = computed(() => props.variant === 'mono' ? props.monoColor : '#4A9EFF')
const peakFill = computed(() => props.variant === 'mono' ? props.monoColor : '#FFB400')
</script>
