import { ref } from 'vue'

export type SetType = 'working' | 'warmup' | 'failure' | 'drop' | 'myorep'

const SET_TYPE_REST_DEFAULTS: Record<SetType, number> = {
  working: 90,
  warmup:  30,
  failure: 120,
  drop:    60,
  myorep:  60,
}

interface ExerciseSettings {
  restSeconds:        number                      // default for this exercise
  setTypeRest?:       Partial<Record<SetType, number>>
}

const DEFAULT_REST = 90
const data = ref<Record<string, ExerciseSettings>>(
  JSON.parse(localStorage.getItem('exerciseSettings') ?? '{}')
)

function _save() { localStorage.setItem('exerciseSettings', JSON.stringify(data.value)) }

export function useExerciseSettings() {
  function getRestTime(exerciseId: string, setType?: SetType): number {
    const ex = data.value[exerciseId]
    if (setType && ex?.setTypeRest?.[setType] != null) return ex.setTypeRest[setType]!
    if (ex?.restSeconds != null) return ex.restSeconds
    return setType ? SET_TYPE_REST_DEFAULTS[setType] : DEFAULT_REST
  }

  function setRestTime(exerciseId: string, seconds: number, setType?: SetType) {
    const ex = data.value[exerciseId] ?? { restSeconds: DEFAULT_REST }
    if (setType) {
      ex.setTypeRest = { ...(ex.setTypeRest ?? {}), [setType]: seconds }
    } else {
      ex.restSeconds = seconds
    }
    data.value[exerciseId] = ex
    _save()
  }

  function getSetTypeDefaults() { return SET_TYPE_REST_DEFAULTS }

  return { DEFAULT_REST, SET_TYPE_REST_DEFAULTS, getRestTime, setRestTime, getSetTypeDefaults }
}
