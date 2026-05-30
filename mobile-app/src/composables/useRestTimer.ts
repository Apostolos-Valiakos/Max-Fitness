import { ref, computed } from 'vue'

// Module-level singleton — persists for the app lifetime and across navigation
const remaining   = ref(0)
const total       = ref(90)
const isRunning   = ref(false)
const isFinished  = ref(false)
const isMinimized = ref(false)
// Tracks which set triggered the rest — survives WorkoutActiveView remounts
const activeSetId = ref<string | null>(null)

// Wall-clock anchor: rest finishes at this absolute timestamp
let endTime = 0
let interval: ReturnType<typeof setInterval> | null = null
let pendingNotifId = 0

const progress  = computed(() => total.value > 0 ? (remaining.value / total.value) * 100 : 0)
const formatted = computed(() => {
  const m = Math.floor(remaining.value / 60)
  const s = remaining.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

function _beep() {
  try {
    const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'; osc.frequency.value = 880
    gain.gain.setValueAtTime(0.6, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.7)
  } catch {}
}

async function _scheduleNotif(seconds: number) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const { display } = await LocalNotifications.checkPermissions()
    if (display !== 'granted') {
      const res = await LocalNotifications.requestPermissions()
      if (res.display !== 'granted') return
    }
    if (pendingNotifId) {
      await LocalNotifications.cancel({ notifications: [{ id: pendingNotifId }] }).catch(() => {})
    }
    pendingNotifId = Date.now() % 100000
    await LocalNotifications.schedule({
      notifications: [{
        id:       pendingNotifId,
        title:    'Rest Over!',
        body:     'Time to get back to it 💪',
        schedule: { at: new Date(Date.now() + seconds * 1000) },
        sound:    undefined,
      }],
    })
  } catch {}
}

async function _cancelNotif() {
  if (!pendingNotifId) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: pendingNotifId }] })
    pendingNotifId = 0
  } catch {}
}

function _clearInterval() {
  if (interval) { clearInterval(interval); interval = null }
}

// Wall-clock tick: derive remaining from endTime so background pauses don't drift
function _tick() {
  const now  = Date.now()
  const secs = Math.max(0, Math.ceil((endTime - now) / 1000))
  remaining.value = secs
  if (secs <= 0) {
    _clearInterval()
    isRunning.value   = false
    isFinished.value  = true
    isMinimized.value = false
    _beep()
    try { navigator.vibrate?.([200, 100, 200]) } catch {}
  }
}

// Resync after coming back from background — call on app foreground
function resync() {
  if (!isRunning.value) return
  const secs = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
  if (secs <= 0) {
    _tick() // trigger finish immediately
  } else {
    remaining.value = secs
  }
}

function start(seconds?: number, setId?: string) {
  _clearInterval()
  total.value       = seconds ?? total.value
  endTime           = Date.now() + total.value * 1000
  remaining.value   = total.value
  isRunning.value   = true
  isFinished.value  = false
  isMinimized.value = false
  if (setId !== undefined) activeSetId.value = setId
  interval = setInterval(_tick, 1000)
  _scheduleNotif(total.value)
}

function setActive(setId: string | null) { activeSetId.value = setId }

function minimize() { isMinimized.value = true }
function expand()   { isMinimized.value = false }

function skip() {
  _clearInterval()
  _cancelNotif()
  remaining.value   = 0
  isRunning.value   = false
  isFinished.value  = false
  isMinimized.value = false
  activeSetId.value = null
}

function addTime(seconds: number) {
  const newRemaining = Math.max(0, remaining.value + seconds)
  endTime           = Date.now() + newRemaining * 1000
  remaining.value   = newRemaining
  total.value       = Math.max(total.value, newRemaining)
  isFinished.value  = false
  if (!isRunning.value) {
    isRunning.value = true
    interval = setInterval(_tick, 1000)
  }
  _cancelNotif().then(() => _scheduleNotif(newRemaining))
}

export function useRestTimer() {
  return {
    remaining, total, isRunning, isFinished, isMinimized, activeSetId, progress, formatted,
    start, skip, setActive, minimize, expand, addTime, resync,
  }
}
