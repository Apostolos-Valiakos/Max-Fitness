<template>
  <div>
    <div class="window-row">
      <button
        v-for="w in WINDOWS"
        :key="w.days"
        class="window-btn"
        :class="{ active: days === w.days }"
        @click="setWindow(w.days)"
      >
        {{ w.label }}
      </button>
    </div>
    <div class="chart-wrap">
      <Bar v-if="loaded" :data="chartData" :options="chartOptions" />
      <div v-else class="chart-empty">No data for the selected period</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Bar } from "vue-chartjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { getMuscleVolumeData } from "@/composables/useCharts";
import { useAuthStore } from "@/stores/authStore";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const WINDOWS = [
  { days: 7, label: "7D" },
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
];

const auth = useAuthStore();
const days = ref(30);
const chartData = ref<any>({});
const loaded = ref(false);

const chartOptions = {
  indexAxis: "y" as const,
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
      grid: { color: "transparent" },
    },
  },
};

async function load() {
  if (!auth.user?.id) return;
  loaded.value = false;
  const data = await getMuscleVolumeData(auth.user.id, days.value);
  if (data && data.labels.length) {
    chartData.value = data;
    loaded.value = true;
  }
}

function setWindow(d: number) {
  days.value = d;
}

watch(days, load, { immediate: true });
</script>

<style scoped>
.window-row {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}
.window-btn {
  background: var(--surface);
  border: 1px solid #3a3a3c;
  color: var(--muted);
  font-family: "Barlow Condensed", sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  cursor: pointer;
  letter-spacing: 0.1em;
}
.window-btn.active {
  border-color: #4a9eff;
  color: #4a9eff;
}
.chart-wrap {
  height: 200px;
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
