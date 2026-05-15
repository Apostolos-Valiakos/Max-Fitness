<template>
  <div class="chart-wrap">
    <Line v-if="loaded" :data="chartData" :options="chartOptions" />
    <div v-else class="chart-empty">No data yet</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js'
import { getVolumeChartData } from '@/composables/useCharts'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const props = defineProps<{ exerciseId: string }>()
const chartData = ref<any>({})
const loaded    = ref(false)
const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: '#1A1A1A' } }, y: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: '#1A1A1A' } } } }

onMounted(async () => {
  chartData.value = await getVolumeChartData(props.exerciseId)
  loaded.value = chartData.value.labels?.length > 0
})
</script>

<style scoped>
.chart-wrap { height: 160px; position: relative; }
.chart-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: #444; font-size: 0.8rem; }
</style>
