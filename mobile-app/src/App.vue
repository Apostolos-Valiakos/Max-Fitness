<template>
  <div class="dark">
    <router-view />
    <Toast position="top-center" group="global" />
  </div>
</template>

<script setup lang="ts">
import Toast from 'primevue/toast'
</script>

<style>
@import './assets/main.css';
.dark { height: 100%; }
</style>
