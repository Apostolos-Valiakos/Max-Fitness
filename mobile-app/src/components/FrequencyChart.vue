<template>
  <div class="chart-wrap">
    <Bar v-if="loaded" :data="chartData" :options="chartOptions" />
    <div v-else class="chart-empty">No data yet</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
import { getFrequencyChartData } from '@/composables/useCharts'
import { supabase } from '@/lib/supabase'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const chartData    = ref<any>({})
const loaded       = ref(false)
const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: '#1A1A1A' } }, y: { ticks: { color: '#555', font: { size: 10 }, stepSize: 1 }, grid: { color: '#1A1A1A' } } } }

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  chartData.value = await getFrequencyChartData(user.id)
  loaded.value    = chartData.value.labels?.length > 0
})
</script>

<style scoped>
.chart-wrap { height: 160px; position: relative; }
.chart-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: #777; font-size: 0.8rem; }
</style>
