<template>
  <div class="chart-wrap">
    <Line v-if="entries.length > 1" :data="chartData" :options="chartOptions" />
    <div v-else class="chart-empty">Log your weight to see trends</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Line } from "vue-chartjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import { getBodyweightChartData } from "@/composables/useCharts";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
);

const props = defineProps<{ entries: { date: string; kg: number }[] }>();
const chartData = computed(() => getBodyweightChartData(props.entries));
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      ticks: { color: "#636366", font: { size: 10 } },
      grid: { color: "#252528" },
    },
    y: {
      ticks: { color: "#636366", font: { size: 10 } },
      grid: { color: "#252528" },
    },
  },
};
</script>

<style scoped>
.chart-wrap {
  height: 160px;
  position: relative;
}
.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #8e8e93;
  font-size: 0.8rem;
}
</style>
