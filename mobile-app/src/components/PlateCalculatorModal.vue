<template>
  <Teleport to="body">
    <div v-if="visible" class="plate-backdrop" @click.self="emit('close')">
      <div class="plate-modal">
        <div class="plate-header">
          <span class="plate-title">PLATE CALCULATOR</span>
          <button class="plate-close" @click="emit('close')">✕</button>
        </div>

        <!-- Target weight input -->
        <div class="weight-row">
          <button class="w-btn" @click="adjustTarget(-step)">−</button>
          <div class="weight-display">
            <span class="weight-val">{{ displayTarget }}</span>
            <span class="weight-unit">{{ units.label.value }}</span>
          </div>
          <button class="w-btn" @click="adjustTarget(step)">+</button>
        </div>

        <!-- Bar selector -->
        <div class="bar-row">
          <button
            v-for="bar in bars"
            :key="bar.kg + '-' + bar.label"
            class="bar-btn"
            :class="{ active: selectedBarKg === bar.kg }"
            @click="selectedBarKg = bar.kg"
          >
            {{ barLabel(bar) }}
          </button>
        </div>

        <!-- Visual bar -->
        <div class="bar-visual">
          <div class="sleeve left">
            <div
              v-for="(p, i) in expandedPlates.slice().reverse()"
              :key="'l' + i"
              class="plate"
              :style="plateStyle(p)"
            />
          </div>
          <div class="bar-tube" />
          <div class="collar" />
          <div class="bar-center" />
          <div class="collar" />
          <div class="bar-tube" />
          <div class="sleeve right">
            <div
              v-for="(p, i) in expandedPlates"
              :key="'r' + i"
              class="plate"
              :style="plateStyle(p)"
            />
          </div>
        </div>

        <!-- Plate list: per-side breakdown -->
        <div class="section-label">PER SIDE</div>
        <div class="plate-list">
          <div
            v-if="!platesPerSide.length && remainder < 0.01"
            class="plate-empty"
          >
            Bar only
          </div>
          <div v-for="item in platesPerSide" :key="item.kg" class="plate-item">
            <span class="plate-badge" :style="plateStyle(item.kg)">{{
              plateLabelShort(item.kg)
            }}</span>
            <span class="plate-count">× {{ item.count }}</span>
          </div>
          <div v-if="remainder > 0.01" class="plate-remainder">
            ⚠ {{ formatWeight(remainder) }} {{ units.label.value }} unaccounted
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useUnits } from "@/composables/useUnits";
import { useUserSettingsStore } from "@/stores/userSettingsStore";

const props = defineProps<{ visible: boolean; weightKg: number }>();
const emit = defineEmits<{ close: [] }>();

const units = useUnits();
const settings = useUserSettingsStore();

// Bars available — user's bar weight + presets
const bars = computed(() => {
  const custom = settings.barWeightKg;
  const presets = [20, 15, 10, 0];
  const all = [...new Set([custom, ...presets])].sort((a, b) => b - a);
  return all.map((kg) => ({ kg, label: kg === 0 ? "No bar" : `${kg}kg` }));
});
const selectedBarKg = ref(settings.barWeightKg);

// Target weight in kg (internal)
const targetKg = ref(props.weightKg);
watch(
  () => props.weightKg,
  (v) => {
    targetKg.value = v;
  },
);

const step = computed(() => units.weightStep.value);

// Display in current units
const displayTarget = computed(() => {
  const v = units.toDisplay(targetKg.value);
  return v != null ? v : 0;
});

function adjustTarget(delta: number) {
  const current = units.toDisplay(targetKg.value) ?? 0;
  const next = Math.max(0, parseFloat((current + delta).toFixed(2)));
  targetKg.value = units.toKg(next);
}

// Use user-configured plates (sorted heaviest first)
const PLATES_KG = computed(() => settings.sortedPlates);

function barLabel(bar: { kg: number; label: string }): string {
  if (bar.kg === 0) return "No bar";
  if (units.label.value === "lbs") return `${Math.round(bar.kg * 2.20462)}lb`;
  return bar.label;
}

function plateLabelShort(plateKg: number): string {
  if (units.label.value === "lbs") {
    const lbs = plateKg * 2.20462;
    return lbs % 1 < 0.05 ? `${Math.round(lbs)}` : lbs.toFixed(1);
  }
  return plateKg % 1 === 0 ? `${plateKg}` : `${plateKg}`;
}

function formatWeight(kg: number): string {
  if (units.label.value === "lbs") return (kg * 2.20462).toFixed(2);
  return kg.toFixed(2);
}

interface PlateItem {
  kg: number;
  count: number;
}

const platesPerSide = computed<PlateItem[]>(() => {
  const load = Math.max(0, (targetKg.value - selectedBarKg.value) / 2);
  if (load <= 0) return [];
  const result: PlateItem[] = [];
  let rem = load;
  for (const p of PLATES_KG.value) {
    if (rem < p - 0.001) continue;
    const count = Math.floor(rem / p + 0.001);
    if (count > 0) {
      result.push({ kg: p, count });
      rem -= count * p;
    }
  }
  return result;
});

const expandedPlates = computed<number[]>(() => {
  const out: number[] = [];
  for (const item of platesPerSide.value) {
    for (let i = 0; i < Math.min(item.count, 6); i++) out.push(item.kg);
  }
  return out;
});

const remainder = computed(() => {
  const load = Math.max(0, (targetKg.value - selectedBarKg.value) / 2);
  if (load <= 0) return 0;
  let rem = load;
  for (const p of PLATES_KG.value) {
    if (rem < p - 0.001) continue;
    const count = Math.floor(rem / p + 0.001);
    rem -= count * p;
  }
  return rem;
});

// Visual plate colours by size
const PLATE_COLORS: Record<number, string> = {
  25: "#E53935",
  20: "#1565C0",
  15: "#F9A825",
  10: "#2E7D32",
  5: "#fff",
  2.5: "#8E8E93",
  1.25: "#3A3A3C",
  0.5: "#2C2C2E",
  0.25: "#252528",
};

function plateStyle(kg: number): Record<string, string> {
  const h = Math.max(24, Math.min(56, kg * 2.2));
  return {
    height: `${h}px`,
    background: PLATE_COLORS[kg] ?? "#636366",
    border: `1px solid rgba(255,255,255,0.1)`,
  };
}
</script>

<style scoped>
.plate-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.plate-modal {
  width: 100%;
  max-width: 480px;
  background: #1c1c1e;
  border-top: 2px solid #4a9eff;
  padding: 1.25rem 1rem 2rem;
  border-radius: 0;
  max-height: 90dvh;
  overflow-y: auto;
}

.plate-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}
.plate-title {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 1rem;
  font-weight: 800;
  color: #f0f0f0;
  letter-spacing: 0.1em;
}
.plate-close {
  background: none;
  border: none;
  color: #636366;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem;
}
.plate-close:active {
  color: #4a9eff;
}

/* Weight row */
.weight-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
}
.w-btn {
  background: #252528;
  border: 1px solid #3a3a3c;
  color: #aeaeb2;
  width: 40px;
  height: 40px;
  font-size: 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.w-btn:active {
  background: #3a3a3c;
  color: #4a9eff;
}
.weight-display {
  text-align: center;
  min-width: 80px;
}
.weight-val {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 2.5rem;
  font-weight: 900;
  color: #4a9eff;
}
.weight-unit {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 1rem;
  color: #636366;
  margin-left: 4px;
}

/* Bar selector */
.bar-row {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}
.bar-btn {
  background: #252528;
  border: 1px solid #3a3a3c;
  color: #8e8e93;
  font-family: "Barlow Condensed", sans-serif;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  letter-spacing: 0.05em;
  transition:
    border-color 0.15s,
    color 0.15s;
}
.bar-btn.active {
  border-color: #4a9eff;
  color: #4a9eff;
}

/* Visual bar */
.bar-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  height: 64px;
  margin-bottom: 1.25rem;
  overflow: hidden;
}
.sleeve {
  display: flex;
  align-items: center;
  gap: 2px;
}
.sleeve.left {
  flex-direction: row-reverse;
}
.sleeve.right {
  flex-direction: row;
}
.plate {
  width: 10px;
  border-radius: 2px;
}
.bar-tube {
  width: 20px;
  height: 8px;
  background: #aeaeb2;
  border-radius: 1px;
}
.collar {
  width: 8px;
  height: 14px;
  background: #aeaeb2;
  border-radius: 1px;
}
.bar-center {
  width: 100px;
  height: 8px;
  background: #aeaeb2;
  border-radius: 1px;
  flex-shrink: 0;
}

/* Plate list */
.section-label {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #8e8e93;
  margin-bottom: 0.5rem;
}
.plate-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.plate-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.plate-badge {
  width: 56px;
  height: 28px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Barlow Condensed", sans-serif;
  font-size: 0.85rem;
  font-weight: 800;
  color: #f0f0f0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  flex-shrink: 0;
}
.plate-count {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 1rem;
  font-weight: 700;
  color: #aeaeb2;
}
.plate-empty {
  font-size: 0.85rem;
  color: #8e8e93;
  text-align: center;
  padding: 0.5rem 0;
}
.plate-remainder {
  font-size: 0.75rem;
  color: #ff8c00;
  margin-top: 0.25rem;
}
</style>
