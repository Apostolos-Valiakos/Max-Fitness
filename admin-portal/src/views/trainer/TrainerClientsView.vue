<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">MY CLIENTS</h1>
        <div class="page-sub">{{ clients.length }} assigned client{{ clients.length !== 1 ? 's' : '' }}</div>
      </div>
    </div>

    <div v-if="loading" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading...</div>

    <div v-else-if="clients.length === 0" class="empty-state card">
      <i class="pi pi-users empty-icon" />
      <div class="empty-title">No clients assigned yet</div>
      <div class="empty-sub">Ask your admin to assign clients to your trainer account.</div>
    </div>

    <div v-else class="client-grid">
      <div v-for="c in clients" :key="c.id" class="client-card card">
        <div class="client-top">
          <img v-if="c.avatar_url" :src="c.avatar_url" class="client-avatar-img" />
          <div v-else class="client-avatar">{{ initials(c) }}</div>
          <div class="client-info">
            <div class="client-name">{{ c.full_name ?? '—' }}</div>
            <div class="client-email">{{ c.email }}</div>
            <span class="badge" :class="c.tier">{{ c.tier?.toUpperCase() }}</span>
          </div>
        </div>
        <div class="client-stats">
          <div class="stat">
            <div class="stat-val">{{ sessionCounts[c.id] ?? 0 }}</div>
            <div class="stat-label">Sessions</div>
          </div>
          <div class="stat">
            <div class="stat-val orange">{{ pendingCheckins[c.id] ?? 0 }}</div>
            <div class="stat-label">Pending check-ins</div>
          </div>
        </div>
        <div class="client-actions">
          <router-link :to="`/trainer/checkins?client=${c.id}`" class="btn btn-ghost btn-sm">
            <i class="pi pi-check-square" /> Check-ins
          </router-link>
          <router-link :to="`/trainer/plan-builder?client=${c.id}`" class="btn btn-ghost btn-sm">
            <i class="pi pi-list-check" /> Plans
          </router-link>
          <router-link :to="`/trainer/clients/${c.id}`" class="btn btn-primary btn-sm">
            <i class="pi pi-chart-line" /> Progress
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface TrainerClient {
  id: string; full_name: string | null; email: string; tier: string; avatar_url: string | null
}

const auth    = useAuthStore()
const loading = ref(true)
const clients = ref<TrainerClient[]>([])
const sessionCounts  = ref<Record<string, number>>({})
const pendingCheckins = ref<Record<string, number>>({})

function initials(c: TrainerClient) {
  const name = c.full_name ?? c.email ?? '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

onMounted(async () => {
  const trainerId = auth.user?.id
  if (!trainerId) return

  // Load assigned clients via trainer_assignments
  const { data: assignments } = await supabase
    .from('trainer_assignments')
    .select('client_id')
    .eq('trainer_id', trainerId)
    .eq('is_active', true)

  const clientIds = (assignments ?? []).map(a => a.client_id)
  if (!clientIds.length) { loading.value = false; return }

  // Load profiles
  const { data: profiles } = await supabase
    .from('profiles').select('id, full_name, tier, avatar_url').in('id', clientIds)
  clients.value = (profiles ?? []).map(p => ({ ...p, email: '' }))

  // Session counts
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('user_id')
    .in('user_id', clientIds)
    .not('finished_at', 'is', null)

  for (const s of sessions ?? []) {
    sessionCounts.value[s.user_id] = (sessionCounts.value[s.user_id] ?? 0) + 1
  }

  // Pending check-ins (due and not yet submitted)
  const now = new Date().toISOString()
  const { data: assignments2 } = await supabase
    .from('checkin_assignments')
    .select('id, client_id')
    .eq('trainer_id', trainerId)
    .eq('is_active', true)
    .lte('next_due_at', now)

  const assignmentIds = (assignments2 ?? []).map(a => a.id)
  if (assignmentIds.length) {
    const { data: submitted } = await supabase
      .from('checkin_submissions')
      .select('assignment_id')
      .in('assignment_id', assignmentIds)

    const submittedIds = new Set((submitted ?? []).map(s => s.assignment_id))
    for (const a of assignments2 ?? []) {
      if (!submittedIds.has(a.id)) {
        pendingCheckins.value[a.client_id] = (pendingCheckins.value[a.client_id] ?? 0) + 1
      }
    }
  }

  loading.value = false
})
</script>

<style scoped>
.page { padding: 2rem; }
.page-header { margin-bottom: 1.75rem; }
.page-title { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: #F0F0F0; letter-spacing: 0.05em; }
.page-sub   { font-size: 0.75rem; color: #444; margin-top: 0.2rem; }

.loading-state { text-align: center; padding: 4rem; color: #444; }

.empty-state { padding: 4rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.empty-icon  { font-size: 2.5rem; color: #2A2A2A; }
.empty-title { font-family: 'Barlow Condensed', sans-serif; font-size: 1.1rem; font-weight: 700; color: #555; letter-spacing: 0.05em; }
.empty-sub   { font-size: 0.8rem; color: #333; }

.client-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }

.client-card { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
.client-top  { display: flex; align-items: flex-start; gap: 0.875rem; }
.client-avatar { width: 44px; height: 44px; background: #FF4D00; display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed', sans-serif; font-size: 1.1rem; font-weight: 900; color: #fff; flex-shrink: 0; }
.client-avatar-img { width: 44px; height: 44px; object-fit: cover; flex-shrink: 0; }
.client-info { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
.client-name  { font-size: 0.92rem; font-weight: 600; color: #C0C0C0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.client-email { font-size: 0.72rem; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.client-stats { display: flex; gap: 1.5rem; padding: 0.75rem 0; border-top: 1px solid #1A1A1A; border-bottom: 1px solid #1A1A1A; }
.stat { display: flex; flex-direction: column; gap: 0.15rem; }
.stat-val   { font-family: 'Barlow Condensed', sans-serif; font-size: 1.4rem; font-weight: 900; color: #888; line-height: 1; }
.stat-val.orange { color: #FF4D00; }
.stat-label { font-size: 0.62rem; color: #444; text-transform: uppercase; letter-spacing: 0.08em; }

.client-actions { display: flex; gap: 0.5rem; }
</style>
