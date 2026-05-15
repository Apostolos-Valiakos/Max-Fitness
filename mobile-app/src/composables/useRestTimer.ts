import { ref, computed } from 'vue'

// Module-level singleton — persists for the app lifetime and across navigation
const remaining   = ref(0)
const total       = ref(90)
const isRunning   = ref(false)
const isFinished  = ref(false)
const isMinimized = ref(false)
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
    // Cancel any pending notification from previous timer
    if (pendingNotifId) {
      await LocalNotifications.cancel({ notifications: [{ id: pendingNotifId }] }).catch(() => {})
    }
    pendingNotifId = Date.now() % 100000 // unique enough
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

function _tick() {
  if (remaining.value <= 0) {
    _clearInterval()
    isRunning.value   = false
    isFinished.value  = true
    isMinimized.value = false
    _beep()
    try { navigator.vibrate?.([200, 100, 200]) } catch {}
  } else {
    remaining.value--
  }
}

function start(seconds?: number) {
  _clearInterval()
  total.value       = seconds ?? total.value
  remaining.value   = total.value
  isRunning.value   = true
  isFinished.value  = false
  isMinimized.value = false
  interval = setInterval(_tick, 1000)
  _scheduleNotif(total.value)
}

function minimize() { isMinimized.value = true }
function expand()   { isMinimized.value = false }

function skip() {
  _clearInterval()
  _cancelNotif()
  remaining.value   = 0
  isRunning.value   = false
  isFinished.value  = false
  isMinimized.value = false
}

function addTime(seconds: number) {
  remaining.value  = Math.max(0, remaining.value + seconds)
  total.value      = Math.max(total.value, remaining.value)
  isFinished.value = false
  if (!isRunning.value) {
    isRunning.value = true
    interval = setInterval(_tick, 1000)
  }
  // Reschedule with updated time
  _cancelNotif().then(() => _scheduleNotif(remaining.value))
}

export function useRestTimer() {
  return { remaining, total, isRunning, isFinished, isMinimized, progress, formatted, start, skip, minimize, expand, addTime }
}
