<template>
  <div class="set-builder">
    <div class="set-header-row">
      <span class="col-num">#</span>
      <span class="col-type">Type</span>
      <span class="col-reps">Reps</span>
    </div>

    <div v-for="(s, i) in local" :key="i" class="set-row">
      <span class="set-num">{{ i + 1 }}</span>

      <Select
        :model-value="s.set_type"
        :options="SET_TYPE_OPTIONS"
        option-label="label"
        option-value="value"
        class="type-select"
        @update:model-value="(v) => setType(i, v)"
      />

      <input
        v-model.number="local[i].target_reps"
        type="number"
        min="1"
        max="999"
        class="reps-input"
        placeholder="—"
        @change="flush"
      />

      <button class="remove-btn" @click="remove(i)" title="Remove set">
        <i class="pi pi-times" />
      </button>
    </div>

    <button class="add-btn" @click="add">
      <i class="pi pi-plus" /> Add Set
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Select from 'primevue/select'

export interface SetConfig {
  set_type: 'warmup' | 'working' | 'failure' | 'drop' | 'myorep'
  target_reps: number | null
}

const props = defineProps<{ modelValue: SetConfig[] }>()
const emit  = defineEmits<{ (e: 'update:modelValue', v: SetConfig[]): void }>()

// Local mutable copy — avoids cursor-reset from parent re-renders on every keystroke
const local = ref<SetConfig[]>(props.modelValue.map(s => ({ ...s })))

watch(
  () => props.modelValue,
  (val) => {
    // Sync only if the change came from outside (not from our own flush)
    if (JSON.stringify(val) !== JSON.stringify(local.value)) {
      local.value = val.map(s => ({ ...s }))
    }
  },
  { deep: true },
)

const SET_TYPE_OPTIONS = [
  { label: 'Warmup',  value: 'warmup'  },
  { label: 'Working', value: 'working' },
  { label: 'Failure', value: 'failure' },
  { label: 'Drop',    value: 'drop'    },
  { label: 'Myorep',  value: 'myorep'  },
]

function flush() {
  emit('update:modelValue', local.value.map(s => ({ ...s, target_reps: s.target_reps || null })))
}

function setType(i: number, value: string) {
  local.value[i] = { ...local.value[i], set_type: value as SetConfig['set_type'] }
  flush()
}

function remove(i: number) {
  local.value.splice(i, 1)
  flush()
}

function add() {
  local.value.push({ set_type: 'working', target_reps: null })
  flush()
}
</script>

<style scoped>
.set-builder { display: flex; flex-direction: column; gap: 0.3rem; }

.set-header-row {
  display: grid;
  grid-template-columns: 22px 1fr 72px 28px;
  gap: 0.5rem;
  align-items: center;
  padding: 0 0 0.15rem;
}
.col-num, .col-type, .col-reps {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #636366;
  text-transform: uppercase;
}

.set-row {
  display: grid;
  grid-template-columns: 22px 1fr 72px 28px;
  gap: 0.5rem;
  align-items: center;
}

.set-num {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  color: #636366;
  text-align: center;
}

/* Fill full column width */
.type-select { width: 100%; }

.reps-input {
  width: 100%;
  background: #252528;
  border: 1px solid #3A3A3C;
  color: #F0F0F0;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.85rem;
  padding: 0.42rem 0.5rem;
  text-align: center;
  -moz-appearance: textfield;
}
.reps-input::-webkit-inner-spin-button,
.reps-input::-webkit-outer-spin-button { -webkit-appearance: none; }
.reps-input:focus { outline: none; border-color: #4A9EFF; }

.remove-btn {
  background: none;
  border: none;
  color: #636366;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 0.7rem;
  transition: color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.remove-btn:hover { color: #FF6B6B; }

.add-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: 1px dashed #3A3A3C;
  color: #636366;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 0.35rem 0.65rem;
  cursor: pointer;
  margin-top: 0.35rem;
  transition: border-color 0.15s, color 0.15s;
  width: fit-content;
}
.add-btn:hover { border-color: #4A9EFF; color: #4A9EFF; }
</style>
