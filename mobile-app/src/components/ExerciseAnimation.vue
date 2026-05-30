<template>
  <div class="anim-wrap">
    <!-- Frame 0 — always visible (start position) -->
    <img
      :src="imageUrl"
      :alt="alt"
      class="frame"
      loading="lazy"
      @error="frame0Failed = true"
    />
    <!-- Frame 1 — cross-fades on top (end position).
         Derived by swapping /0.jpg → /1.jpg in the URL.
         Only rendered for the GitHub CDN dataset; skipped for GIF URLs. -->
    <img
      v-if="frame1Url && !frame1Failed"
      :src="frame1Url"
      :alt="alt"
      class="frame frame-1"
      loading="lazy"
      @error="frame1Failed = true"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  imageUrl: string
  alt?:     string
}>()

const frame0Failed = ref(false)
const frame1Failed = ref(false)

// Derive frame-1 URL only for the GitHub CDN images (ends in /0.jpg).
// Real GIFs (.gif extension) animate on their own — no second frame needed.
const frame1Url = computed(() => {
  if (!props.imageUrl || props.imageUrl.endsWith('.gif')) return null
  return props.imageUrl.replace(/\/0\.jpg$/, '/1.jpg')
})
</script>

<style scoped>
.anim-wrap {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
  overflow: hidden;
}

.frame {
  max-height: 280px;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  display: block;
}

/* Frame 1 sits on top and cross-fades in and out continuously */
.frame-1 {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  animation: cross-fade 2s ease-in-out infinite;
}

@keyframes cross-fade {
  0%, 10%   { opacity: 0; }
  40%, 60%  { opacity: 1; }
  90%, 100% { opacity: 0; }
}
</style>
