<template>
  <div class="view">
    <header class="view-header">
      <h1 class="view-title">PROFILE</h1>
    </header>

    <!-- Avatar + name -->
    <div class="profile-hero">
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
      </div>
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
import { useRouter } from 'vue-router'
import Dialog    from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useAuthStore }         from '@/stores/authStore'
import { useProfileStore }      from '@/stores/profileStore'
import { useUserSettingsStore } from '@/stores/userSettingsStore'
import BodyweightChart from '@/components/BodyweightChart.vue'
import { format } from 'date-fns'

const BAR_PRESETS  = [10, 15, 20]
const ALL_PLATES   = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5]

const router       = useRouter()
const auth         = useAuthStore()
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
.view { padding: 1.5rem 1rem 2rem; color: #F0F0F0; font-family: 'DM Sans',sans-serif; background: #1C1C1E; min-height: 100vh; }
.view-header { margin-bottom: 1.5rem; }
.view-title { font-family: 'Barlow Condensed',sans-serif; font-size: 1.8rem; font-weight: 900; color: #F0F0F0; }
.profile-hero { display: flex; align-items: center; gap: 1.25rem; margin-bottom: 2rem; padding: 1.25rem; background: #1C1C1E; border: 1px solid #252528; clip-path: polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%); }
.avatar-wrap { position: relative; width: 60px; height: 60px; cursor: pointer; flex-shrink: 0; }
.avatar-img { width: 60px; height: 60px; object-fit: cover; display: block; clip-path: polygon(0 0,100% 0,100% 75%,85% 100%,0 100%); }
.avatar { width: 60px; height: 60px; background: #4A9EFF; display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed',sans-serif; font-size: 1.4rem; font-weight: 900; color: #fff; clip-path: polygon(0 0,100% 0,100% 75%,85% 100%,0 100%); }
.avatar-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1rem; opacity: 0; transition: opacity 0.15s; clip-path: polygon(0 0,100% 0,100% 75%,85% 100%,0 100%); }
.avatar-wrap:active .avatar-overlay { opacity: 1; }
.avatar-file-input { display: none; }
.avatar-status { font-size: 0.68rem; color: #4A9EFF; margin-top: 0.25rem; }
.profile-name { font-family: 'Barlow Condensed',sans-serif; font-size: 1.3rem; font-weight: 800; color: #F0F0F0; }
.profile-email { font-size: 0.75rem; color: #636366; margin-bottom: 0.4rem; }
.tier-pill { display: inline-block; padding: 0.2rem 0.5rem; font-family: 'Barlow Condensed',sans-serif; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.2em; }
.tier-pill.free  { background: #252528; color: #636366; }
.tier-pill.paid  { background: rgba(74,158,255,0.1); color: #4A9EFF; border: 1px solid rgba(74,158,255,0.3); }
.tier-pill.ultra { background: rgba(255,180,0,0.1); color: #FFB400; border: 1px solid rgba(255,180,0,0.3); }
.section { margin-bottom: 2rem; }
.trainer-card { display: flex; align-items: flex-start; gap: 1rem; background: rgba(255,180,0,0.04); border: 1px solid rgba(255,180,0,0.2); padding: 1rem; }
.trainer-avatar-img { width: 44px; height: 44px; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(255,180,0,0.3); }
.trainer-avatar { width: 44px; height: 44px; background: rgba(255,180,0,0.15); border: 1px solid rgba(255,180,0,0.3); display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 900; color: #FFB400; flex-shrink: 0; }
.trainer-info { flex: 1; }
.trainer-name  { font-family: 'Barlow Condensed',sans-serif; font-size: 1rem; font-weight: 800; color: #F0F0F0; }
.trainer-label { font-size: 0.68rem; color: #636366; margin-top: 0.1rem; text-transform: uppercase; letter-spacing: 0.08em; }
.trainer-bio   { font-size: 0.78rem; color: #8E8E93; margin-top: 0.5rem; line-height: 1.4; }
.trainer-empty { font-size: 0.82rem; color: #8E8E93; padding: 0.75rem 0; }
.bio-textarea  { resize: vertical; min-height: 72px; font-family: inherit; line-height: 1.5; width: 100%; }
.bw-row { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
.bw-input { flex: 1; background: #1C1C1E; border: 1px solid #3A3A3C; color: #F0F0F0; font-family: 'DM Sans',sans-serif; font-size: 1rem; padding: 0.65rem 0.75rem; }
.bw-input:focus { outline: none; border-color: #4A9EFF; }
.bw-btn { background: #4A9EFF; border: none; color: #fff; font-family: 'Barlow Condensed',sans-serif; font-weight: 800; letter-spacing: 0.1em; padding: 0 1.25rem; cursor: pointer; clip-path: polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%); }
.bw-btn:disabled { background: #3A3A3C; cursor: not-allowed; }
.chart-card { background: #1C1C1E; border: 1px solid #252528; padding: 1rem; }
.edit-form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.2em; color: #636366; }
.save-ok  { font-size: 0.78rem; color: #2EAF52; display: flex; align-items: center; gap: 0.35rem; }
.pw-error { font-size: 0.78rem; color: #4A9EFF; display: flex; align-items: center; gap: 0.35rem; }
.save-btn { background: #1C1C1E; border: 1px solid #4A9EFF; color: #4A9EFF; font-family: 'Barlow Condensed',sans-serif; font-weight: 700; letter-spacing: 0.1em; padding: 0.7rem; cursor: pointer; transition: background 0.15s; }
.save-btn:active { background: rgba(74,158,255,0.1); }
.settings-list { background: #1C1C1E; border: 1px solid #252528; }
.settings-row { display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; border-bottom: 1px solid #252528; font-size: 0.85rem; color: #8E8E93; }
.link-row { cursor: pointer; }
.link-row:active { background: #1C1C1E; }
.settings-row:last-child { border-bottom: none; }
.settings-val { color: #AEAEB2; font-weight: 500; }
.settings-val.free  { color: #636366; }
.settings-val.paid  { color: #4A9EFF; }
.settings-val.ultra { color: #FFB400; }
.signout-btn { width: 100%; background: #1C1C1E; border: 1px solid #3A3A3C; color: #636366; font-family: 'Barlow Condensed',sans-serif; font-weight: 700; letter-spacing: 0.15em; font-size: 0.9rem; padding: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.15s; }
.signout-btn:active { border-color: #4A9EFF; color: #4A9EFF; }
.unit-toggle { display: flex; gap: 0; }
.unit-btn { background: #252528; border: 1px solid #3A3A3C; color: #636366; font-family: 'Barlow Condensed',sans-serif; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.3rem 0.75rem; cursor: pointer; transition: all 0.15s; }
.unit-btn.active { background: rgba(74,158,255,0.1); border-color: #4A9EFF; color: #4A9EFF; }
.bar-pick { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.bar-btn { background: #252528; border: 1px solid #3A3A3C; color: #636366; font-family: 'Barlow Condensed',sans-serif; font-size: 0.72rem; font-weight: 700; padding: 0.25rem 0.6rem; cursor: pointer; transition: all 0.15s; }
.bar-btn.active { background: rgba(74,158,255,0.1); border-color: #4A9EFF; color: #4A9EFF; }
.section-sub { font-size: 0.72rem; color: #8E8E93; margin-bottom: 0.6rem; margin-top: -0.4rem; }
.plate-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.plate-chip { background: #252528; border: 1px solid #3A3A3C; color: #636366; font-family: 'Barlow Condensed',sans-serif; font-size: 0.82rem; font-weight: 700; padding: 0.35rem 0.75rem; cursor: pointer; transition: all 0.15s; min-width: 52px; text-align: center; }
.plate-chip.active { background: rgba(74,158,255,0.1); border-color: #4A9EFF; color: #4A9EFF; }
.create-form { display: flex; flex-direction: column; gap: 1rem; }
.dialog-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.dialog-btn { flex: 1; border: none; font-family: 'Barlow Condensed',sans-serif; font-weight: 700; letter-spacing: 0.1em; font-size: 0.9rem; padding: 0.75rem; cursor: pointer; }
.dialog-btn.cancel { background: #252528; color: #AEAEB2; }
.dialog-btn.finish { background: #4A9EFF; color: #fff; clip-path: polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%); }
</style>
