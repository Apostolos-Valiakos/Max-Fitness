import { computed } from 'vue'
import { useUserSettingsStore } from '@/stores/userSettingsStore'

// Thin shim — delegates to userSettingsStore so existing components don't need changes.
export function useUnits() {
  const settings = useUserSettingsStore()

  function setUnit(u: 'kg' | 'lbs') { settings.setUnit(u) }

  function displayWeight(kg: number | null | undefined): string {
    if (kg == null) return '—'
    const v = settings.toDisplay(kg)!
    return Number.isInteger(v) ? String(v) : v.toFixed(1)
  }

  function toDisplay(kg: number | null | undefined): number | null {
    if (kg == null) return null
    const v = settings.toDisplay(kg)!
    return parseFloat(v.toFixed(1))
  }

  function toKg(displayed: number): number { return settings.toKg(displayed) }

  const unit       = computed(() => settings.unit)
  const label      = computed(() => settings.unit)
  const weightStep = computed(() => settings.unit === 'lbs' ? 5 : 2.5)

  return { unit, label, weightStep, setUnit, displayWeight, toDisplay, toKg }
}
