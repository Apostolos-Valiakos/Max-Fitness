<template>
  <div class="view">
    <ViewHeader title="MEASUREMENTS" back />

    <!-- Log form -->
    <section class="section">
      <h2 class="section-title">LOG TODAY</h2>
      <div class="form-grid">
        <div class="field" v-for="f in FIELDS" :key="f.key">
          <label>{{ f.label }}</label>
          <input
            v-model.number="form[f.key as keyof typeof form]"
            type="number"
            inputmode="decimal"
            :placeholder="f.unit"
            class="m-input"
            :step="f.key === 'body_fat_pct' ? 0.1 : 0.5"
          />
        </div>
        <div class="field full">
          <label>NOTES</label>
          <input v-model="formNotes" type="text" class="m-input" placeholder="Optional" />
        </div>
      </div>
      <button class="log-btn" @click="handleLog">LOG MEASUREMENTS</button>
    </section>

    <!-- History table -->
    <section class="section" v-if="entries.length">
      <h2 class="section-title">HISTORY</h2>
      <div class="table-wrap">
        <table class="m-table">
          <thead>
            <tr>
              <th>Date</th>
              <th v-for="f in FIELDS" :key="f.key">{{ f.short }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in entries" :key="e.id">
              <td class="date-cell">{{ format(new Date(e.measured_at), 'MMM d') }}</td>
              <td v-for="f in FIELDS" :key="f.key">{{ e[f.key as keyof typeof e] ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-else class="empty-state">
      <p>No measurements logged yet.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ViewHeader from '@/components/ViewHeader.vue'
import { supabase }  from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { format } from 'date-fns'

const FIELDS = [
  { key: 'weight_kg',      label: 'WEIGHT',       short: 'Wt',  unit: 'kg'  },
  { key: 'body_fat_pct',   label: 'BODY FAT %',   short: 'BF%', unit: '%'   },
  { key: 'chest_cm',       label: 'CHEST',        short: 'Ch',  unit: 'cm'  },
  { key: 'waist_cm',       label: 'WAIST',        short: 'Wa',  unit: 'cm'  },
  { key: 'hips_cm',        label: 'HIPS',         short: 'Hi',  unit: 'cm'  },
  { key: 'left_arm_cm',    label: 'L. ARM',       short: 'LA',  unit: 'cm'  },
  { key: 'right_arm_cm',   label: 'R. ARM',       short: 'RA',  unit: 'cm'  },
  { key: 'left_thigh_cm',  label: 'L. THIGH',     short: 'LT',  unit: 'cm'  },
  { key: 'right_thigh_cm', label: 'R. THIGH',     short: 'RT',  unit: 'cm'  },
]

const router = useRouter()
const auth   = useAuthStore()

const form = reactive<Record<string, number | null>>({
  weight_kg: null, body_fat_pct: null, chest_cm: null, waist_cm: null, hips_cm: null,
  left_arm_cm: null, right_arm_cm: null, left_thigh_cm: null, right_thigh_cm: null,
})
const formNotes = ref('')
const entries   = ref<any[]>([])

onMounted(async () => { await loadEntries() })

async function loadEntries() {
  if (!auth.user?.id) return
  const { data } = await supabase
    .from('body_measurements')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('measured_at', { ascending: false })
    .limit(30)
  entries.value = data ?? []
}

async function handleLog() {
  if (!auth.user?.id) return
  const today = new Date().toISOString().split('T')[0]
  const payload: any = { user_id: auth.user.id, measured_at: today }
  for (const f of FIELDS) {
    if (form[f.key] != null) payload[f.key] = form[f.key]
  }
  if (formNotes.value) payload.notes = formNotes.value
  await supabase.from('body_measurements').upsert(payload, { onConflict: 'user_id,measured_at' })
  // Reset form
  for (const k of Object.keys(form)) form[k] = null
  formNotes.value = ''
  await loadEntries()
}
</script>

<style scoped>
.view { padding: 1.5rem 1rem 2rem; color: var(--text); font-family: 'DM Sans',sans-serif; background: var(--bg); min-height: 100vh; }
.section { margin-bottom: 2rem; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.25rem; }
.field.full { grid-column: 1 / -1; }
.field label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.15em; color: var(--muted); }
.m-input { background: var(--bg); border: 1px solid var(--border); color: var(--text); font-size: 0.9rem; padding: 0.55rem 0.65rem; width: 100%; font-family: 'DM Sans',sans-serif; }
.m-input:focus { outline: none; border-color: var(--accent); }
.log-btn { width: 100%; background: var(--accent); border: none; color: #fff; font-family: 'Barlow Condensed',sans-serif; font-weight: 800; letter-spacing: 0.1em; font-size: 1rem; padding: 0.85rem; cursor: pointer; clip-path: var(--clip-md); }
.table-wrap { overflow-x: auto; }
.m-table { width: 100%; border-collapse: collapse; font-size: 0.72rem; }
.m-table th { font-family: 'Barlow Condensed',sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; color: var(--muted); text-align: right; padding: 0.35rem 0.4rem; border-bottom: 1px solid var(--surface); }
.m-table th:first-child { text-align: left; }
.m-table td { color: #AEAEB2; text-align: right; padding: 0.4rem 0.4rem; border-bottom: 1px solid var(--bg); }
.m-table td.date-cell { text-align: left; color: var(--muted); font-size: 0.68rem; white-space: nowrap; }
.m-table tr:hover td { background: var(--bg); }
.empty-state { text-align: center; padding: 3rem 1rem; color: var(--sub); font-size: 0.85rem; }
</style>
