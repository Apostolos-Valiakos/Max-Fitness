import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export type WeightUnit = 'kg' | 'lbs'

export interface PlateConfig {
  plates: number[]   // available plate weights in kg
}

const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]
const DEFAULT_BAR_KG    = 20
const KG_TO_LBS         = 2.20462

export const useUserSettingsStore = defineStore('userSettings', () => {
  const unit        = ref<WeightUnit>('kg')
  const barWeightKg = ref<number>(DEFAULT_BAR_KG)
  const plates      = ref<number[]>([...DEFAULT_PLATES_KG])
  const loaded      = ref(false)

  // ── Conversion helpers ──────────────────────────────────────────────────────

  const unitLabel = computed(() => unit.value)

  function toDisplay(kg: number | null): number | null {
    if (kg == null) return null
    return unit.value === 'lbs' ? Math.round(kg * KG_TO_LBS * 4) / 4 : kg
  }

  function toKg(value: number): number {
    return unit.value === 'lbs' ? value / KG_TO_LBS : value
  }

  function formatWeight(kg: number | null): string {
    if (kg == null) return '—'
    const v = toDisplay(kg)!
    return `${Number.isInteger(v) ? v : v.toFixed(1)} ${unit.value}`
  }

  // ── Plate helpers ───────────────────────────────────────────────────────────

  const platesDisplay = computed(() =>
    plates.value.map(p => unit.value === 'lbs' ? Math.round(p * KG_TO_LBS * 4) / 4 : p)
  )

  const sortedPlates = computed(() => [...plates.value].sort((a, b) => b - a))

  // ── Persistence ─────────────────────────────────────────────────────────────

  async function load() {
    // Try Supabase first
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('preferred_unit, bar_weight_kg, plate_config')
        .eq('id', user.id)
        .maybeSingle()
      if (data) {
        if (data.preferred_unit) unit.value = data.preferred_unit as WeightUnit
        if (data.bar_weight_kg != null) barWeightKg.value = Number(data.bar_weight_kg)
        if (data.plate_config?.plates) plates.value = data.plate_config.plates
        loaded.value = true
        _saveLocal()
        return
      }
    }
    // Fallback: localStorage
    _loadLocal()
    loaded.value = true
  }

  async function save() {
    _saveLocal()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({
      preferred_unit: unit.value,
      bar_weight_kg:  barWeightKg.value,
      plate_config:   { plates: plates.value },
    }).eq('id', user.id)
  }

  function _saveLocal() {
    localStorage.setItem('mf_unit',     unit.value)
    localStorage.setItem('mf_bar',      String(barWeightKg.value))
    localStorage.setItem('mf_plates',   JSON.stringify(plates.value))
  }

  function _loadLocal() {
    const u = localStorage.getItem('mf_unit')
    if (u === 'kg' || u === 'lbs') unit.value = u
    const b = localStorage.getItem('mf_bar')
    if (b) barWeightKg.value = Number(b)
    const p = localStorage.getItem('mf_plates')
    if (p) { try { plates.value = JSON.parse(p) } catch {} }
  }

  function setUnit(u: WeightUnit) { unit.value = u; save() }
  function setBarWeight(kg: number) { barWeightKg.value = kg; save() }
  function setPlates(kgs: number[]) { plates.value = kgs; save() }

  return {
    unit, unitLabel, barWeightKg, plates, sortedPlates, platesDisplay, loaded,
    toDisplay, toKg, formatWeight,
    load, save, setUnit, setBarWeight, setPlates,
  }
})
