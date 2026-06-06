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
          <div v-else class="client-avatar">{{ initials(c.full_name ?? c.email) }}</div>
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
          <Button
            icon="pi pi-check-square"
            label="Check-ins"
            severity="secondary"
            outlined
            size="small"
            class="action-btn"
            :badge="pendingCheckins[c.id] ? String(pendingCheckins[c.id]) : undefined"
            badge-severity="warn"
            @click="router.push(`/trainer/checkins?client=${c.id}`)"
          />
          <Button
            icon="pi pi-list-check"
            label="Plans"
            severity="secondary"
            outlined
            size="small"
            class="action-btn"
            @click="router.push(`/trainer/plan-builder?client=${c.id}`)"
          />
          <Button
            icon="pi pi-chart-line"
            label="Progress"
            size="small"
            class="action-btn"
            @click="router.push(`/trainer/clients/${c.id}`)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { initials } from '@/lib/utils'
import Button from 'primevue/button'

const router = useRouter()

interface TrainerClient {
  id: string; full_name: string | null; email: string; tier: string; avatar_url: string | null
}

const auth    = useAuthStore()
const loading = ref(true)
const clients = ref<TrainerClient[]>([])
const sessionCounts  = ref<Record<string, number>>({})
const pendingCheckins = ref<Record<string, number>>({})


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
.page-header { margin-bottom: 1.75rem; }

.loading-state { text-align: center; padding: 4rem; color: var(--muted); }

.empty-state { padding: 4rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.empty-icon  { font-size: 2.5rem; color: var(--border); }
.empty-title { font-family: 'Barlow Condensed', sans-serif; font-size: 1.1rem; font-weight: 700; color: var(--muted); letter-spacing: 0.05em; }
.empty-sub   { font-size: 0.8rem; color: var(--border); }

.client-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }

.client-card { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
.client-top  { display: flex; align-items: flex-start; gap: 0.875rem; }
.client-avatar { width: 44px; height: 44px; background: var(--accent); display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed', sans-serif; font-size: 1.1rem; font-weight: 900; color: #fff; flex-shrink: 0; }
.client-avatar-img { width: 44px; height: 44px; object-fit: cover; flex-shrink: 0; }
.client-info { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
.client-name  { font-size: 0.92rem; font-weight: 600; color: #C7C7CC; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.client-email { font-size: 0.72rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.client-stats { display: flex; gap: 1.5rem; padding: 0.75rem 0; border-top: 1px solid var(--surface); border-bottom: 1px solid var(--surface); }
.stat { display: flex; flex-direction: column; gap: 0.15rem; }
.stat-val   { font-family: 'Barlow Condensed', sans-serif; font-size: 1.4rem; font-weight: 900; color: #AEAEB2; line-height: 1; }
.stat-val.orange { color: var(--accent); }
.stat-label { font-size: 0.62rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }

.client-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; padding-top: 0.25rem; }
.action-btn     { justify-content: center; width: 100%; }
</style>
