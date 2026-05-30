<template>
  <div class="view">
    <header class="view-header">
      <h1 class="view-title">MY CLIENTS</h1>
      <button class="plans-btn" @click="router.push('/trainer/plans')">
        <i class="pi pi-list" /> PLANS
      </button>
    </header>

    <div v-if="trainer.loading" class="loading-state">
      <i class="pi pi-spin pi-spinner" /> Loading clients...
    </div>

    <div v-else-if="trainer.clients.length === 0" class="empty-state">
      <i class="pi pi-users empty-icon" />
      <p>No clients assigned yet.</p>
      <p class="empty-sub">Ask an admin to assign clients to you.</p>
    </div>

    <div v-else class="client-list">
      <div
        v-for="client in trainer.clients"
        :key="client.id"
        class="client-card"
        @click="router.push('/trainer/client/' + client.id)"
      >
        <div class="client-avatar">{{ initials(client) }}</div>
        <div class="client-body">
          <div class="client-name">{{ client.full_name ?? 'Unknown' }}</div>
          <div class="client-meta">
            <span class="tier-chip" :class="client.tier">{{ client.tier.toUpperCase() }}</span>
            <span class="last-session" v-if="client.last_session_at">
              Last: {{ fmtDate(client.last_session_at) }}
            </span>
            <span class="last-session no-session" v-else>No sessions yet</span>
          </div>
        </div>
        <i class="pi pi-chevron-right chevron" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTrainerStore } from '@/stores/trainerStore'
import type { TrainerClient } from '@/stores/trainerStore'
import { format } from 'date-fns'

const router  = useRouter()
const trainer = useTrainerStore()

function initials(c: TrainerClient) {
  const n = c.full_name ?? c.email ?? '?'
  return n.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}
function fmtDate(iso: string) { return format(new Date(iso), 'MMM d') }

onMounted(() => trainer.fetchClients())
</script>

<style scoped>
.view { padding: 0 0 100px; }
.view-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1rem 0.75rem;
}
.view-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.5rem; font-weight: 900; color: #F0F0F0; letter-spacing: 0.05em;
}
.plans-btn {
  display: flex; align-items: center; gap: 0.35rem;
  background: #1A1A1A; border: 1px solid #2A2A2A; color: #888;
  padding: 0.4rem 0.75rem; font-size: 0.68rem; font-weight: 700;
  letter-spacing: 0.1em; cursor: pointer; font-family: 'Barlow Condensed', sans-serif;
}
.plans-btn:hover { color: #FF4D00; border-color: #FF4D00; }

.loading-state { text-align: center; padding: 3rem; color: #777; }
.empty-state   { text-align: center; padding: 4rem 2rem; color: #777; }
.empty-icon    { font-size: 2.5rem; color: #555; display: block; margin-bottom: 1rem; }
.empty-sub     { font-size: 0.75rem; margin-top: 0.5rem; color: #666; }

.client-list { display: flex; flex-direction: column; gap: 1px; padding: 0.5rem 0; }

.client-card {
  display: flex; align-items: center; gap: 0.875rem;
  padding: 0.875rem 1rem; background: #111;
  cursor: pointer; transition: background 0.15s;
}
.client-card:hover { background: #161616; }
.client-card:active { background: #1A1A1A; }

.client-avatar {
  width: 42px; height: 42px; border-radius: 0; flex-shrink: 0;
  background: rgba(255,77,0,0.1); border: 1px solid rgba(255,77,0,0.2);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Barlow Condensed', sans-serif; font-size: 1rem;
  font-weight: 900; color: #FF4D00;
}
.client-body { flex: 1; min-width: 0; }
.client-name { font-size: 0.92rem; font-weight: 600; color: #E0E0E0; }
.client-meta { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.2rem; }
.tier-chip {
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.58rem;
  font-weight: 700; letter-spacing: 0.12em; padding: 0.1rem 0.35rem;
  border: 1px solid;
}
.tier-chip.free   { color: #555; border-color: #2A2A2A; background: #1A1A1A; }
.tier-chip.paid   { color: #4DA6FF; border-color: rgba(77,166,255,0.3); background: rgba(77,166,255,0.08); }
.tier-chip.ultra  { color: #FFD700; border-color: rgba(255,215,0,0.3); background: rgba(255,215,0,0.08); }
.last-session  { font-size: 0.7rem; color: #555; }
.no-session    { color: #666; }
.chevron       { color: #666; font-size: 0.8rem; }
</style>
