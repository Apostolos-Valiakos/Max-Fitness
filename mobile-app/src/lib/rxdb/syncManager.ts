import { ref } from 'vue'
import { Network } from '@capacitor/network'
import { startReplication, stopReplication } from './replication'
import { supabase } from '@/lib/supabase'

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error'
export const syncStatus = ref<SyncState>('idle')

let replicationActive = false

export async function initSyncManager() {
  // Listen for auth changes
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      stopReplication()
      replicationActive = false
      syncStatus.value = 'idle'
    }
    if (event === 'SIGNED_IN' && !replicationActive) {
      kickoffSync()
    }
  })

  // Listen for network changes
  Network.addListener('networkStatusChange', (status) => {
    if (status.connected) {
      if (!replicationActive) kickoffSync()
    } else {
      syncStatus.value = 'offline'
    }
  })

  // Check current network state
  const status = await Network.getStatus()
  if (!status.connected) { syncStatus.value = 'offline'; return }

  // Check if user is logged in
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  await kickoffSync()
}

async function kickoffSync() {
  syncStatus.value = 'syncing'
  replicationActive = true
  try {
    await startReplication()
    syncStatus.value = 'idle'
  } catch (err) {
    console.error('[syncManager] replication error:', err)
    syncStatus.value = 'error'
    replicationActive = false
  }
}

export async function retrySync() {
  if (replicationActive) return
  const status = await Network.getStatus()
  if (!status.connected) { syncStatus.value = 'offline'; return }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  await kickoffSync()
}
