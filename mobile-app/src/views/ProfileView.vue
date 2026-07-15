<template>
  <div class="view">
    <header class="view-header">
      <h1 class="view-title">PROFILE</h1>
    </header>

    <!-- Avatar + name — guard on auth.profile so beforeEach waits for real data -->
    <div v-if="auth.profile" class="profile-hero">
      <div class="avatar-wrap" @click="triggerAvatarPick">
        <img v-if="auth.profile?.avatar_url" :src="auth.profile.avatar_url" class="avatar-img" />
        <div v-else class="avatar">{{ initials }}</div>
        <div class="avatar-overlay"><i class="pi pi-camera" /></div>
        <input ref="avatarInput" type="file" accept="image/jpeg,image/png,image/webp" class="avatar-file-input" @change="handleAvatarChange" />
      </div>
      <div class="profile-info">
        <div class="profile-name">{{ auth.profile?.full_name ?? 'Athlete' }}</div>
        <div class="profile-email">{{ auth.user?.email }}</div>
        <div class="tier-pill" :class="auth.profile?.tier">{{ auth.profile?.tier?.toUpperCase() }}</div>
        <div v-if="avatarUploading" class="avatar-status">Uploading photo…</div>
      </div>
    </div>

    <!-- Subscription / plan upgrade -->
    <section class="section">
      <h2 class="section-title">MY PLAN</h2>

      <!-- Current plan status -->
      <div class="plan-current" :class="auth.profile?.tier">
        <div class="plan-info">
          <div class="plan-label">CURRENT PLAN</div>
          <div class="plan-name">{{ TIER_INFO[auth.profile?.tier ?? 'free'].name }}</div>
          <div class="plan-price-line">{{ TIER_INFO[auth.profile?.tier ?? 'free'].price }}</div>
        </div>
        <span class="plan-badge" :class="auth.profile?.tier">
          {{ (auth.profile?.tier ?? 'free').toUpperCase() }}
        </span>
      </div>

      <!-- Verifying payment -->
      <div v-if="verifyingPayment" class="verifying-state">
        <i class="pi pi-spin pi-spinner" /> Verifying payment…
      </div>

      <!-- Upgrade options (shown when not on ultra and not verifying) -->
      <div v-else-if="auth.profile?.tier !== 'ultra'" class="upgrade-options">
        <div
          v-for="opt in upgradeOptions"
          :key="opt.tier"
          class="upgrade-card"
        >
          <div class="uc-header">
            <div>
              <div class="uc-name">{{ opt.name }}</div>
              <div class="uc-price">{{ opt.price }}<span class="uc-period">/mo</span></div>
            </div>
            <span class="uc-badge" :class="opt.tier">{{ opt.tier.toUpperCase() }}</span>
          </div>
          <ul class="uc-features">
            <li v-for="f in opt.features" :key="f"><i class="pi pi-check" /> {{ f }}</li>
          </ul>
          <button
            class="uc-btn"
            :disabled="upgradeLoading === opt.tier"
            @click="startUpgrade(opt.tier)"
          >
            <i v-if="upgradeLoading === opt.tier" class="pi pi-spin pi-spinner" />
            <span v-else>UPGRADE TO {{ opt.tier.toUpperCase() }}</span>
          </button>
        </div>
      </div>

      <!-- Manage billing (paid/ultra users) -->
      <button
        v-if="auth.profile?.tier !== 'free' && !verifyingPayment"
        class="manage-btn"
        :disabled="portalLoading"
        @click="openPortal"
      >
        <i v-if="portalLoading" class="pi pi-spin pi-spinner" />
        <span v-else><i class="pi pi-external-link" /> Manage Billing</span>
      </button>

      <div v-if="upgradeError" class="upgrade-error">{{ upgradeError }}</div>
      <div v-if="upgradeSuccess" class="upgrade-success"><i class="pi pi-check-circle" /> Plan upgraded successfully!</div>
    </section>

    <!-- Trainer (any user with an active trainer assignment) -->
    <section v-if="profileStore.trainer" class="section">
      <h2 class="section-title">MY TRAINER</h2>
      <div class="trainer-card">
        <img v-if="profileStore.trainer.avatar_url" :src="profileStore.trainer.avatar_url" class="trainer-avatar-img" />
        <div v-else class="trainer-avatar">{{ trainerInitials }}</div>
        <div class="trainer-info">
          <div class="trainer-name">{{ profileStore.trainer.full_name ?? 'Your Trainer' }}</div>
          <div class="trainer-label">Personal Trainer</div>
          <div v-if="profileStore.trainer.bio" class="trainer-bio">{{ profileStore.trainer.bio }}</div>
        </div>
      </div>
    </section>

    <!-- Bodyweight -->
    <section class="section">
      <h2 class="section-title">LOG BODYWEIGHT</h2>
      <div class="bw-row">
        <input v-model.number="bwInput" class="bw-input" type="number" step="0.1" placeholder="kg" inputmode="decimal" />
        <button class="bw-btn" @click="handleLogBW" :disabled="!bwInput">LOG</button>
      </div>
      <div class="chart-card" v-if="profileStore.bodyweightLog.length > 1">
        <BodyweightChart :entries="profileStore.bodyweightLog" />
      </div>
    </section>

    <!-- Edit profile -->
    <section class="section">
      <h2 class="section-title">EDIT PROFILE</h2>
      <div class="edit-form">
        <div class="field"><label>FULL NAME</label><InputText v-model="editName" class="mf-input" /></div>
        <div class="field"><label>EMAIL</label><InputText :value="auth.user?.email" class="mf-input" disabled /></div>
        <div class="field"><label>BIO</label><textarea v-model="editBio" class="bw-input bio-textarea" rows="3" placeholder="Short description…" maxlength="280" /></div>
        <div v-if="profileSaved" class="save-ok"><i class="pi pi-check" /> Saved.</div>
        <button class="save-btn" @click="handleSave">SAVE CHANGES</button>
      </div>
    </section>

    <!-- Change password -->
    <section class="section">
      <h2 class="section-title">CHANGE PASSWORD</h2>
      <div class="edit-form">
        <div class="field"><label>CURRENT PASSWORD</label><input v-model="pwCurrent" class="bw-input" type="password" autocomplete="current-password" /></div>
        <div class="field"><label>NEW PASSWORD</label><input v-model="pwNew" class="bw-input" type="password" autocomplete="new-password" /></div>
        <div class="field"><label>CONFIRM NEW PASSWORD</label><input v-model="pwConfirm" class="bw-input" type="password" autocomplete="new-password" /></div>
        <div v-if="pwError" class="pw-error"><i class="pi pi-exclamation-triangle" /> {{ pwError }}</div>
        <div v-if="pwSaved" class="save-ok"><i class="pi pi-check" /> Password updated.</div>
        <button class="save-btn" @click="handleChangePassword" :disabled="pwSaving || !pwCurrent || !pwNew || !pwConfirm">
          {{ pwSaving ? 'Updating…' : 'UPDATE PASSWORD' }}
        </button>
      </div>
    </section>

    <!-- Preferences -->
    <section class="section">
      <h2 class="section-title">PREFERENCES</h2>
      <div class="settings-list">
        <div class="settings-row">
          <span>Weight unit</span>
          <div class="unit-toggle">
            <button class="unit-btn" :class="{ active: settings.unit === 'kg' }"  @click="settings.setUnit('kg')">KG</button>
            <button class="unit-btn" :class="{ active: settings.unit === 'lbs' }" @click="settings.setUnit('lbs')">LBS</button>
          </div>
        </div>
        <div class="settings-row">
          <span>Bar weight</span>
          <div class="bar-pick">
            <button v-for="b in BAR_PRESETS" :key="b" class="bar-btn" :class="{ active: settings.barWeightKg === b }" @click="settings.setBarWeight(b)">{{ b }}kg</button>
            <button class="bar-btn" :class="{ active: !BAR_PRESETS.includes(settings.barWeightKg) }" @click="showCustomBar = true">
              {{ !BAR_PRESETS.includes(settings.barWeightKg) ? settings.barWeightKg + 'kg' : 'Custom' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Plate config -->
    <section class="section">
      <h2 class="section-title">MY PLATES (kg)</h2>
      <p class="section-sub">Tap to toggle which plates you own</p>
      <div class="plate-grid">
        <button
          v-for="p in ALL_PLATES"
          :key="p"
          class="plate-chip"
          :class="{ active: settings.plates.includes(p) }"
          @click="togglePlate(p)"
        >{{ p }}</button>
      </div>
    </section>

    <!-- Custom bar dialog -->
    <Dialog v-model:visible="showCustomBar" modal header="CUSTOM BAR WEIGHT" :style="{ width: '80vw', maxWidth: '320px' }" class="mf-dialog">
      <div class="create-form">
        <div class="field"><label>WEIGHT (KG)</label><input v-model.number="customBarInput" class="bw-input" type="number" inputmode="decimal" step="0.5" /></div>
        <div class="dialog-actions">
          <button class="dialog-btn cancel" @click="showCustomBar = false">Cancel</button>
          <button class="dialog-btn finish" @click="applyCustomBar">Apply</button>
        </div>
      </div>
    </Dialog>

    <!-- Quick links -->
    <section class="section">
      <h2 class="section-title">TRACKING</h2>
      <div class="settings-list">
        <div class="settings-row link-row" @click="router.push('/measurements')">
          <span><i class="pi pi-chart-line" style="margin-right:0.5rem;font-size:0.8rem" />Body Measurements</span>
          <i class="pi pi-chevron-right settings-val" />
        </div>
        <div v-if="!auth.isTrainer && !auth.isAdmin" class="settings-row link-row" @click="router.push('/checkin')">
          <span><i class="pi pi-clipboard" style="margin-right:0.5rem;font-size:0.8rem" />Weekly Check-in</span>
          <i class="pi pi-chevron-right settings-val" />
        </div>
      </div>
    </section>

    <!-- Stats -->
    <section class="section">
      <h2 class="section-title">ACCOUNT</h2>
      <div class="settings-list">
        <div class="settings-row">
          <span>Plan</span>
          <span class="settings-val" :class="auth.profile?.tier">{{ auth.profile?.tier?.toUpperCase() }}</span>
        </div>
        <div class="settings-row">
          <span>Role</span>
          <span class="settings-val">{{ auth.profile?.role?.toUpperCase() }}</span>
        </div>
        <div class="settings-row">
          <span>Member since</span>
          <span class="settings-val">{{ memberSince }}</span>
        </div>
        <div class="settings-row">
          <span>Gym</span>
          <span v-if="auth.profile?.gym_name" class="settings-val gym-val">{{ auth.profile.gym_name }}</span>
          <span v-else class="settings-val muted-val">None</span>
        </div>
      </div>
    </section>

    <!-- Join gym (standalone users only) -->
    <section v-if="!auth.hasGym" class="section">
      <h2 class="section-title">GYM</h2>
      <div class="settings-list">
        <div class="settings-row link-row" @click="router.push('/join-gym')">
          <span><i class="pi pi-building" style="margin-right:0.5rem;font-size:0.8rem;color:var(--accent)" />Join a Gym</span>
          <i class="pi pi-chevron-right settings-val" />
        </div>
      </div>
      <p class="section-sub" style="margin-top:0.5rem">Have a join code from your gym admin? Tap above to connect your account.</p>
    </section>

    <!-- Admin panel link -->
    <section v-if="auth.isAdmin" class="section">
      <h2 class="section-title">ADMIN</h2>
      <div class="settings-list">
        <div class="settings-row link-row" @click="router.push('/admin')">
          <span><i class="pi pi-shield" style="margin-right:0.4rem;color:#4A9EFF" />Admin Panel</span>
          <i class="pi pi-chevron-right settings-arrow" />
        </div>
      </div>
    </section>

    <!-- Sign out -->
    <button class="signout-btn" @click="handleSignOut">
      <i class="pi pi-sign-out" /> SIGN OUT
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Dialog    from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useAuthStore }         from '@/stores/authStore'
import { useProfileStore }      from '@/stores/profileStore'
import { useUserSettingsStore } from '@/stores/userSettingsStore'
import BodyweightChart from '@/components/BodyweightChart.vue'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

const BAR_PRESETS = [10, 15, 20]
const ALL_PLATES  = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5]

const TIER_INFO: Record<string, { name: string; price: string }> = {
  free:  { name: 'Free',  price: '€0/mo'    },
  paid:  { name: 'Paid',  price: '€4.99/mo' },
  ultra: { name: 'Ultra', price: '€9.99/mo' },
}

const UPGRADE_OPTIONS = [
  {
    tier: 'paid',
    name: 'Paid',
    price: '€4.99',
    features: ['Access to all standard workouts', 'Progress tracking', 'Priority support'],
  },
  {
    tier: 'ultra',
    name: 'Ultra',
    price: '€9.99',
    features: ['Everything in Paid', 'Personal trainer assignment', 'Custom workout plans', 'Weekly check-ins'],
  },
]

const upgradeOptions = computed(() => {
  const tier = auth.profile?.tier ?? 'free'
  if (tier === 'free')  return UPGRADE_OPTIONS
  if (tier === 'paid')  return UPGRADE_OPTIONS.filter(o => o.tier === 'ultra')
  return []
})

const upgradeLoading   = ref<string | null>(null)
const portalLoading    = ref(false)
const upgradeError     = ref('')
const upgradeSuccess   = ref(false)
const verifyingPayment = ref(false)

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session ? `Bearer ${session.access_token}` : null
}

async function startUpgrade(tier: string) {
  upgradeError.value = ''; upgradeSuccess.value = false
  upgradeLoading.value = tier

  const authHeader = await getAuthHeader()
  if (!authHeader) { upgradeLoading.value = null; return }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/create-user-checkout`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body:    JSON.stringify({
        tier,
        success_url: `${window.location.origin}/profile?upgraded=1`,
        cancel_url:  `${window.location.origin}/profile`,
      }),
    })
    const json = await res.json()
    if (!res.ok) { upgradeError.value = json.error ?? 'Checkout failed'; return }
    window.location.href = json.url
  } catch (err: any) {
    upgradeError.value = err.message
  } finally {
    upgradeLoading.value = null
  }
}

async function openPortal() {
  upgradeError.value = ''; portalLoading.value = true

  const authHeader = await getAuthHeader()
  if (!authHeader) { portalLoading.value = false; return }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/create-user-portal`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body:    JSON.stringify({ return_url: `${window.location.origin}/profile` }),
    })
    const json = await res.json()
    if (!res.ok) { upgradeError.value = json.error ?? 'Could not open billing portal'; return }
    window.location.href = json.url
  } catch (err: any) {
    upgradeError.value = err.message
  } finally {
    portalLoading.value = false
  }
}

const router = useRouter()
const route  = useRoute()
const auth   = useAuthStore()
const profileStore = useProfileStore()
const settings     = useUserSettingsStore()

const editName        = ref(auth.profile?.full_name ?? '')
const editBio         = ref(auth.profile?.bio ?? '')
const profileSaved    = ref(false)
const avatarInput     = ref<HTMLInputElement | null>(null)
const avatarUploading = ref(false)
const bwInput         = ref<number | null>(null)
const showCustomBar = ref(false)
const customBarInput = ref<number>(settings.barWeightKg)
const pwCurrent  = ref('')
const pwNew      = ref('')
const pwConfirm  = ref('')
const pwError    = ref('')
const pwSaved    = ref(false)
const pwSaving   = ref(false)

const initials = computed(() => {
  const name = auth.profile?.full_name ?? auth.user?.email ?? 'A'
  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
})
const trainerInitials = computed(() => {
  const name = profileStore.trainer?.full_name ?? 'T'
  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
})
const memberSince = computed(() => {
  const d = auth.user?.created_at
  return d ? format(new Date(d), 'MMM yyyy') : '—'
})

onMounted(async () => {
  editName.value = auth.profile?.full_name ?? ''
  editBio.value  = auth.profile?.bio ?? ''
  await settings.load()
  if (auth.user?.id) {
    await profileStore.fetchBodyweightLog(auth.user.id)
    await profileStore.fetchTrainerAssignment(auth.user.id)
  }
  if (route.query.upgraded === '1' && auth.user?.id) {
    const sessionId = route.query.session_id as string | undefined
    router.replace('/profile')
    verifyingPayment.value = true

    if (sessionId) {
      // Verify payment directly with Stripe — no webhook timing dependency
      const authHeader = await getAuthHeader()
      if (authHeader) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/verify-user-checkout`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: authHeader },
            body:    JSON.stringify({ session_id: sessionId }),
          })
          const json = await res.json()
          if (res.ok && json.tier) {
            // Re-fetch profile to sync the updated tier into the store
            await auth.fetchProfile(auth.user.id)
          }
        } catch (err) {
          console.error('verify-user-checkout failed:', err)
        }
      }
    } else {
      // Fallback: re-fetch profile (webhook may have already updated it)
      await auth.fetchProfile(auth.user.id)
    }

    verifyingPayment.value = false
    upgradeSuccess.value = true
    setTimeout(() => { upgradeSuccess.value = false }, 4000)
  }
})

function togglePlate(p: number) {
  const idx = settings.plates.indexOf(p)
  const next = idx >= 0 ? settings.plates.filter(x => x !== p) : [...settings.plates, p]
  settings.setPlates(next)
}

function applyCustomBar() {
  if (customBarInput.value > 0) settings.setBarWeight(customBarInput.value)
  showCustomBar.value = false
}

function triggerAvatarPick() { avatarInput.value?.click() }

async function handleAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  avatarUploading.value = true
  const url = await auth.uploadAvatar(file)
  if (url) await auth.updateProfile({ avatar_url: url })
  avatarUploading.value = false
  ;(e.target as HTMLInputElement).value = ''
}

async function handleSave() {
  await auth.updateProfile({ full_name: editName.value, bio: editBio.value.trim() || null })
  profileSaved.value = true
  setTimeout(() => { profileSaved.value = false }, 2500)
}

async function handleChangePassword() {
  pwError.value = ''; pwSaved.value = false
  if (pwNew.value !== pwConfirm.value) { pwError.value = 'New passwords do not match.'; return }
  if (pwNew.value.length < 6) { pwError.value = 'Password must be at least 6 characters.'; return }
  pwSaving.value = true
  const err = await auth.changePassword(pwCurrent.value, pwNew.value)
  pwSaving.value = false
  if (err) { pwError.value = err; return }
  pwSaved.value = true
  pwCurrent.value = ''; pwNew.value = ''; pwConfirm.value = ''
  setTimeout(() => { pwSaved.value = false }, 3000)
}

async function handleLogBW() {
  if (!bwInput.value) return
  await profileStore.logBodyweight(bwInput.value)
  bwInput.value = null
}

async function handleSignOut() {
  await auth.signOut()
  router.replace('/auth')
}
</script>

<style scoped>
.view { padding: 1.5rem 1rem 2rem; color: var(--text); font-family: 'DM Sans',sans-serif; background: var(--bg); min-height: 100vh; }
.view-header { margin-bottom: 1.5rem; }
.view-title { font-family: 'Barlow Condensed',sans-serif; font-size: 1.8rem; font-weight: 900; color: var(--text); }
.profile-hero { display: flex; align-items: center; gap: 1.25rem; margin-bottom: 2rem; padding: 1.25rem; background: var(--bg); border: 1px solid var(--surface); clip-path: polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%); }
.avatar-wrap { position: relative; width: 60px; height: 60px; cursor: pointer; flex-shrink: 0; }
.avatar-img { width: 60px; height: 60px; object-fit: cover; display: block; clip-path: var(--clip-btn); }
.avatar { width: 60px; height: 60px; background: var(--accent); display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed',sans-serif; font-size: 1.4rem; font-weight: 900; color: #fff; clip-path: var(--clip-btn); }
.avatar-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1rem; opacity: 0; transition: opacity 0.15s; clip-path: var(--clip-btn); }
.avatar-wrap:active .avatar-overlay { opacity: 1; }
.avatar-file-input { display: none; }
.avatar-status { font-size: 0.68rem; color: var(--accent); margin-top: 0.25rem; }
.profile-name { font-family: 'Barlow Condensed',sans-serif; font-size: 1.3rem; font-weight: 800; color: var(--text); }
.profile-email { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.4rem; }
.tier-pill { display: inline-block; padding: 0.2rem 0.5rem; font-family: 'Barlow Condensed',sans-serif; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.2em; }
.tier-pill.free  { background: var(--surface); color: var(--muted); }
.tier-pill.paid  { background: rgba(74,158,255,0.1); color: var(--accent); border: 1px solid rgba(74,158,255,0.3); }
.tier-pill.ultra { background: rgba(255,180,0,0.1); color: var(--gold); border: 1px solid rgba(255,180,0,0.3); }
/* ── MY PLAN section ── */
.plan-current {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem; border: 1px solid var(--surface); margin-bottom: 1rem;
}
.plan-current.paid  { border-color: rgba(74,158,255,0.3); background: rgba(74,158,255,0.04); }
.plan-current.ultra { border-color: rgba(255,180,0,0.3);  background: rgba(255,180,0,0.04);  }
.plan-label      { font-family: 'Barlow Condensed',sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.2em; color: var(--muted); margin-bottom: 0.2rem; }
.plan-name       { font-family: 'Barlow Condensed',sans-serif; font-size: 1.4rem; font-weight: 900; color: var(--text); line-height: 1; }
.plan-price-line { font-size: 0.75rem; color: var(--muted); margin-top: 0.15rem; }
.plan-badge      { font-family: 'Barlow Condensed',sans-serif; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.15em; padding: 0.2rem 0.6rem; border: 1px solid; }
.plan-badge.free  { color: var(--muted); border-color: var(--border); }
.plan-badge.paid  { color: var(--accent); border-color: rgba(74,158,255,0.4); background: rgba(74,158,255,0.08); }
.plan-badge.ultra { color: var(--gold);   border-color: rgba(255,180,0,0.4);  background: rgba(255,180,0,0.08);  }

.upgrade-options { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 0.75rem; }
.upgrade-card { border: 1px solid var(--surface); padding: 1rem; }
.uc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
.uc-name  { font-family: 'Barlow Condensed',sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.15em; color: var(--muted); margin-bottom: 0.2rem; }
.uc-price { font-family: 'Barlow Condensed',sans-serif; font-size: 1.8rem; font-weight: 900; color: var(--text); line-height: 1; }
.uc-period { font-size: 0.85rem; color: var(--muted); }
.uc-badge { font-family: 'Barlow Condensed',sans-serif; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.15em; padding: 0.15rem 0.5rem; border: 1px solid; }
.uc-badge.paid  { color: var(--accent); border-color: rgba(74,158,255,0.4); background: rgba(74,158,255,0.08); }
.uc-badge.ultra { color: var(--gold);   border-color: rgba(255,180,0,0.4);  background: rgba(255,180,0,0.08);  }
.uc-features { list-style: none; padding: 0; margin: 0 0 1rem; display: flex; flex-direction: column; gap: 0.3rem; }
.uc-features li { font-size: 0.78rem; color: var(--sub); display: flex; align-items: center; gap: 0.4rem; }
.uc-features .pi-check { color: #34C759; font-size: 0.68rem; }
.uc-btn {
  width: 100%; background: var(--accent); border: none; color: #fff;
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.9rem; font-weight: 800;
  letter-spacing: 0.12em; padding: 0.75rem; cursor: pointer;
  clip-path: var(--clip-sm); display: flex; align-items: center; justify-content: center; gap: 0.5rem;
}
.uc-btn:disabled { background: var(--border); cursor: not-allowed; }

.manage-btn {
  width: 100%; background: none; border: 1px solid var(--border); color: var(--muted);
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.82rem; font-weight: 700;
  letter-spacing: 0.1em; padding: 0.65rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 0.4rem; margin-top: 0.5rem;
}
.manage-btn:disabled { opacity: 0.5; }

.verifying-state { font-size: 0.82rem; color: var(--muted); padding: 1rem 0; display: flex; align-items: center; gap: 0.5rem; }
.upgrade-error   { font-size: 0.78rem; color: var(--accent); margin-top: 0.5rem; display: flex; align-items: center; gap: 0.35rem; }
.upgrade-success { font-size: 0.78rem; color: #34C759; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.35rem; }

.section { margin-bottom: 2rem; }
.trainer-card { display: flex; align-items: flex-start; gap: 1rem; background: rgba(255,180,0,0.04); border: 1px solid rgba(255,180,0,0.2); padding: 1rem; }
.trainer-avatar-img { width: 44px; height: 44px; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(255,180,0,0.3); }
.trainer-avatar { width: 44px; height: 44px; background: rgba(255,180,0,0.15); border: 1px solid rgba(255,180,0,0.3); display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 900; color: var(--gold); flex-shrink: 0; }
.trainer-info { flex: 1; }
.trainer-name  { font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 800; color: var(--text); }
.trainer-label { font-size: 0.68rem; color: var(--muted); margin-top: 0.1rem; text-transform: uppercase; letter-spacing: 0.08em; }
.trainer-bio   { font-size: 0.78rem; color: var(--sub); margin-top: 0.5rem; line-height: 1.4; }
.trainer-empty { font-size: 0.82rem; color: var(--sub); padding: 0.75rem 0; }
.bio-textarea  { resize: vertical; min-height: 72px; font-family: inherit; line-height: 1.5; width: 100%; }
.bw-row { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
.bw-input { flex: 1; background: var(--bg); border: 1px solid var(--border); color: var(--text); font-family: 'DM Sans',sans-serif; font-size: 1rem; padding: 0.65rem 0.75rem; }
.bw-input:focus { outline: none; border-color: var(--accent); }
.bw-btn { background: var(--accent); border: none; color: #fff; font-family: 'Barlow Condensed',sans-serif; font-weight: 800; letter-spacing: 0.1em; padding: 0 1.25rem; cursor: pointer; clip-path: var(--clip-sm); }
.bw-btn:disabled { background: var(--border); cursor: not-allowed; }
.chart-card { background: var(--bg); border: 1px solid var(--surface); padding: 1rem; }
.edit-form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.2em; color: var(--muted); }
.save-ok  { font-size: 0.78rem; color: #2EAF52; display: flex; align-items: center; gap: 0.35rem; }
.pw-error { font-size: 0.78rem; color: var(--accent); display: flex; align-items: center; gap: 0.35rem; }
.save-btn { background: var(--bg); border: 1px solid var(--accent); color: var(--accent); font-family: 'Barlow Condensed',sans-serif; font-weight: 700; letter-spacing: 0.1em; padding: 0.7rem; cursor: pointer; transition: background 0.15s; }
.save-btn:active { background: rgba(74,158,255,0.1); }
.settings-list { background: var(--bg); border: 1px solid var(--surface); }
.settings-row { display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; border-bottom: 1px solid var(--surface); font-size: 0.85rem; color: var(--sub); }
.link-row { cursor: pointer; }
.link-row:active { background: var(--bg); }
.settings-row:last-child { border-bottom: none; }
.settings-val { color: #AEAEB2; font-weight: 500; }
.settings-val.free  { color: var(--muted); }
.settings-val.paid  { color: var(--accent); }
.settings-val.ultra { color: var(--gold); }
.signout-btn { width: 100%; background: var(--bg); border: 1px solid var(--border); color: var(--muted); font-family: 'Barlow Condensed',sans-serif; font-weight: 700; letter-spacing: 0.15em; font-size: 0.9rem; padding: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.15s; }
.signout-btn:active { border-color: var(--accent); color: var(--accent); }
.unit-toggle { display: flex; gap: 0; }
.unit-btn { background: var(--surface); border: 1px solid var(--border); color: var(--muted); font-family: 'Barlow Condensed',sans-serif; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.3rem 0.75rem; cursor: pointer; transition: all 0.15s; }
.unit-btn.active { background: rgba(74,158,255,0.1); border-color: var(--accent); color: var(--accent); }
.bar-pick { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.bar-btn { background: var(--surface); border: 1px solid var(--border); color: var(--muted); font-family: 'Barlow Condensed',sans-serif; font-size: 0.72rem; font-weight: 700; padding: 0.25rem 0.6rem; cursor: pointer; transition: all 0.15s; }
.bar-btn.active { background: rgba(74,158,255,0.1); border-color: var(--accent); color: var(--accent); }
.section-sub { font-size: 0.72rem; color: var(--sub); margin-bottom: 0.6rem; margin-top: -0.4rem; }
.plate-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.plate-chip { background: var(--surface); border: 1px solid var(--border); color: var(--muted); font-family: 'Barlow Condensed',sans-serif; font-size: 0.82rem; font-weight: 700; padding: 0.35rem 0.75rem; cursor: pointer; transition: all 0.15s; min-width: 52px; text-align: center; }
.plate-chip.active { background: rgba(74,158,255,0.1); border-color: var(--accent); color: var(--accent); }
.gym-val   { color: #34C759; font-weight: 600; }
.muted-val { color: var(--border); }
.create-form { display: flex; flex-direction: column; gap: 1rem; }
.dialog-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.dialog-btn { flex: 1; border: none; font-family: 'Barlow Condensed',sans-serif; font-weight: 700; letter-spacing: 0.1em; font-size: 0.9rem; padding: 0.75rem; cursor: pointer; }
.dialog-btn.cancel { background: var(--surface); color: #AEAEB2; }
.dialog-btn.finish { background: var(--accent); color: #fff; clip-path: var(--clip-sm); }
</style>
