<template>
  <router-view />
  <Toast position="bottom-right" />
  <ConfirmDialog />
</template>

<script setup lang="ts">
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
</script>

<style>
@import './assets/main.css';
</style>
