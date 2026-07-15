<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">GYM SETTINGS</h1>
        <div class="page-sub">{{ gymStore.gym?.name }}</div>
      </div>
    </div>

    <div v-if="!gymStore.gym" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading…</div>

    <template v-else>

      <!-- ── Join Code ─────────────────────────────────────────────────── -->
      <div class="card section-card">
        <div class="section-title">JOIN CODE</div>
        <div class="section-sub">Share this code with trainers or clients to let them join your gym from the mobile app.</div>
        <div class="join-code-row">
          <span class="join-code">{{ gymStore.gym.join_code }}</span>
          <Button severity="secondary" size="small" @click="copyCode">
            <i class="pi" :class="codeCopied ? 'pi-check' : 'pi-copy'" /> {{ codeCopied ? 'Copied!' : 'Copy' }}
          </Button>
        </div>
      </div>

      <!-- ── Invite Staff ──────────────────────────────────────────────── -->
      <div class="card section-card">
        <div class="section-title">INVITE STAFF</div>
        <div class="section-sub">Send an invite link to a trainer or admin. Links expire in 7 days.</div>

        <div class="invite-form">
          <InputText v-model="inviteEmail" placeholder="colleague@example.com" style="flex:1" />
          <Select
            v-model="inviteRole"
            :options="INVITE_ROLES"
            option-label="label"
            option-value="value"
            style="width: 130px"
          />
          <Button @click="createInvite" :loading="creating" :disabled="!inviteEmail.trim()">
            SEND INVITE
          </Button>
        </div>

        <!-- Generated link to copy -->
        <div v-if="newInviteLink" class="invite-link-banner">
          <i class="pi pi-link" />
          <span class="invite-link-url">{{ newInviteLink }}</span>
          <Button severity="secondary" size="small" @click="copyInviteLink">
            <i class="pi" :class="linkCopied ? 'pi-check' : 'pi-copy'" /> {{ linkCopied ? 'Copied!' : 'Copy Link' }}
          </Button>
        </div>

        <div v-if="createError" class="field-error">{{ createError }}</div>
      </div>

      <!-- ── Pending Invites ───────────────────────────────────────────── -->
      <div class="card section-card">
        <div class="section-title">PENDING INVITES</div>

        <div v-if="loadingInvites" class="loading-state"><i class="pi pi-spin pi-spinner" /> Loading…</div>
        <div v-else-if="!pendingInvites.length" class="empty-invites">No pending invites.</div>

        <DataTable v-else :value="pendingInvites" size="small">
          <Column field="email" header="Email">
            <template #body="{ data }">
              <span class="td-name">{{ data.email }}</span>
            </template>
          </Column>
          <Column field="role" header="Role" style="width: 100px">
            <template #body="{ data }">
              <span class="badge" :class="data.role">{{ data.role.toUpperCase() }}</span>
            </template>
          </Column>
          <Column field="expires_at" header="Expires" style="width: 130px">
            <template #body="{ data }">
              <span class="td-muted">{{ fmtDate(data.expires_at) }}</span>
            </template>
          </Column>
          <Column header="" style="width: 160px">
            <template #body="{ data }">
              <div style="display:flex;gap:0.4rem">
                <Button severity="secondary" size="small" :loading="sendingId === data.id" @click="sendInviteEmail(data.id)" title="Resend email"><i class="pi pi-envelope" /></Button>
                <Button severity="secondary" size="small" @click="copyTokenLink(data.token)" :label="copiedToken === data.token ? 'Copied!' : 'Copy Link'" />
                <Button severity="danger" size="small" @click="revokeInvite(data.id)"><i class="pi pi-trash" /></Button>
              </div>
            </template>
          </Column>
        </DataTable>
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useGymStore } from '@/stores/gymStore'
import { useToast } from 'primevue/usetoast'
import { fmtDate } from '@/lib/utils'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const gymStore = useGymStore()
const toast    = useToast()

const inviteEmail  = ref('')
const inviteRole   = ref<'trainer' | 'admin'>('trainer')
const creating     = ref(false)
const createError  = ref('')
const newInviteLink = ref('')
const linkCopied   = ref(false)
const codeCopied   = ref(false)
const copiedToken  = ref('')

const loadingInvites = ref(false)
const pendingInvites = ref<any[]>([])
const sendingId = ref('')

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session ? `Bearer ${session.access_token}` : null
}

async function sendInviteEmail(inviteId: string) {
  sendingId.value = inviteId
  const authHeader = await getAuthHeader()
  if (!authHeader) { sendingId.value = ''; return false }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-invite-email`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body:    JSON.stringify({ invite_id: inviteId }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.add({ severity: 'error', summary: 'Email not sent', detail: json.error ?? 'Failed to send invite email', life: 5000 })
      return false
    }
    toast.add({ severity: 'success', summary: 'Invite emailed', life: 2500 })
    return true
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Email not sent', detail: err.message, life: 5000 })
    return false
  } finally {
    sendingId.value = ''
  }
}

const INVITE_ROLES = [
  { label: 'Trainer', value: 'trainer' },
  { label: 'Admin',   value: 'admin'   },
]

onMounted(loadInvites)

async function loadInvites() {
  if (!gymStore.gym) return
  loadingInvites.value = true
  const { data } = await supabase
    .from('gym_invites')
    .select('id, email, role, token, expires_at, created_at')
    .eq('gym_id', gymStore.gym.id)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  pendingInvites.value = data ?? []
  loadingInvites.value = false
}

async function createInvite() {
  if (!gymStore.gym) return
  creating.value = true; createError.value = ''; newInviteLink.value = ''; linkCopied.value = false

  {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', gymStore.gym.id)
      .in('role', ['trainer', 'admin'])
    if ((count ?? 0) >= gymStore.gym.max_trainers) {
      createError.value = `Trainer/admin limit reached (${gymStore.gym.max_trainers} max on your plan). Upgrade your plan to invite more staff.`
      creating.value = false
      return
    }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { creating.value = false; return }

  const email = inviteEmail.value.trim().toLowerCase()

  // A unique index blocks a second pending (accepted_at IS NULL) invite for
  // the same gym+email — including one that's simply expired, since expiry
  // isn't part of that condition. Renew it in place instead of inserting,
  // so re-inviting (the whole point of this button) always works rather
  // than surfacing a raw constraint-violation error.
  const { data: existing } = await supabase
    .from('gym_invites')
    .select('id')
    .eq('gym_id', gymStore.gym.id)
    .eq('email', email)
    .is('accepted_at', null)
    .maybeSingle()

  const fields = { role: inviteRole.value, invited_by: user.id }

  const { data, error } = existing
    // Renewing a stale invite: give it a fresh token/expiry rather than
    // reviving whatever old link may already be sitting in someone's inbox.
    ? await supabase.from('gym_invites')
        .update({ ...fields, token: crypto.randomUUID().replace(/-/g, ''), expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
        .eq('id', existing.id).select('id, token').single()
    : await supabase.from('gym_invites')
        .insert({ gym_id: gymStore.gym.id, email, ...fields }) // token/expires_at use their DB defaults
        .select('id, token').single()

  creating.value = false
  if (error) {
    createError.value = error.message.includes('gym_invites_gym_email_pending_uniq')
      ? 'An invite is already pending for this email — try again in a moment.'
      : error.message
    return
  }

  newInviteLink.value = `${window.location.origin}/invite/${data.token}`
  inviteEmail.value = ''
  await sendInviteEmail(data.id)
  await loadInvites()
}

async function revokeInvite(id: string) {
  await supabase.from('gym_invites').delete().eq('id', id)
  pendingInvites.value = pendingInvites.value.filter(i => i.id !== id)
  toast.add({ severity: 'info', summary: 'Invite revoked', life: 2000 })
}

function tokenLink(token: string) {
  return `${window.location.origin}/invite/${token}`
}

async function copyCode() {
  await navigator.clipboard.writeText(gymStore.gym?.join_code ?? '')
  codeCopied.value = true
  setTimeout(() => { codeCopied.value = false }, 2000)
}

async function copyInviteLink() {
  await navigator.clipboard.writeText(newInviteLink.value)
  linkCopied.value = true
  setTimeout(() => { linkCopied.value = false }, 2000)
}

async function copyTokenLink(token: string) {
  await navigator.clipboard.writeText(tokenLink(token))
  copiedToken.value = token
  setTimeout(() => { copiedToken.value = '' }, 2000)
}
</script>

<style scoped>
.section-card  { padding: 1.5rem; margin-bottom: 1rem; }
.section-title { font-family: 'Barlow Condensed', sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.15em; color: var(--muted); margin-bottom: 0.35rem; }
.section-sub   { font-size: 0.78rem; color: var(--muted); margin-bottom: 1.25rem; }

.join-code-row { display: flex; align-items: center; gap: 1rem; }
.join-code     { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: var(--accent); letter-spacing: 0.3em; }

.invite-form { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }

.invite-link-banner {
  margin-top: 1rem;
  background: rgba(74,158,255,0.06); border: 1px solid rgba(74,158,255,0.2);
  padding: 0.65rem 1rem; display: flex; align-items: center; gap: 0.75rem;
}
.invite-link-url { font-family: 'DM Mono', monospace; font-size: 0.78rem; color: var(--accent); flex: 1; word-break: break-all; }

.empty-invites { font-size: 0.82rem; color: var(--border); padding: 0.75rem 0; }
.field-error   { font-size: 0.78rem; color: var(--accent); margin-top: 0.6rem; }

.td-name  { color: #C7C7CC; font-weight: 500; }
.td-muted { color: var(--muted); font-size: 0.78rem; }

.badge { font-family: 'Barlow Condensed', sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.15rem 0.4rem; border: 1px solid; }
.badge.trainer { color: #4DA6FF; border-color: rgba(77,166,255,0.3); background: rgba(77,166,255,0.08); }
.badge.admin   { color: #34C759; border-color: rgba(52,199,89,0.3);  background: rgba(52,199,89,0.08);  }
</style>
