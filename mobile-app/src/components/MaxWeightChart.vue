<template>
  <div class="chart-wrap">
    <Line v-if="loaded" :data="chartData" :options="chartOptions" />
    <div v-else class="chart-empty">Not enough data yet</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
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
import { getMaxWeightChartData } from "@/composables/useCharts";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
);

const props = defineProps<{ exerciseId: string }>();

const chartData = ref<any>({});
const loaded = ref(false);

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
      ticks: { color: "#AEAEB2", font: { size: 10 } },
      grid: { color: "#252528" },
    },
  },
};

onMounted(async () => {
  const data = await getMaxWeightChartData(props.exerciseId);
  if (data) {
    chartData.value = data;
    loaded.value = true;
  }
});
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
