<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">MY ACCOUNT</h1>
        <div class="page-sub">Profile settings and security</div>
      </div>
    </div>

    <div class="sections">

      <!-- Profile -->
      <div class="card section-card">
        <div class="section-heading">PROFILE</div>

        <!-- Avatar -->
        <div class="avatar-row">
          <div class="avatar-wrap" @click="triggerAvatarPick" :class="{ uploading: avatarUploading }">
            <img v-if="auth.profile?.avatar_url" :src="auth.profile.avatar_url" class="avatar-img" />
            <div v-else class="avatar-placeholder">{{ initials }}</div>
            <div class="avatar-overlay"><i class="pi pi-camera" /></div>
            <input
              ref="avatarInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="avatar-file-input"
              @change="handleAvatarChange"
            />
          </div>
          <div v-if="avatarUploading" class="avatar-hint">Uploading…</div>
          <div v-else class="avatar-hint">Click to change photo</div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label class="mf-label">FULL NAME</label>
            <InputText v-model="editName" placeholder="Your name" />
          </div>
          <div class="field">
            <label class="mf-label">BIO</label>
            <Textarea v-model="editBio" rows="3" placeholder="Short description, specialties, certifications…" :maxlength="280" auto-resize />
          </div>
          <div class="field">
            <label class="mf-label">EMAIL</label>
            <InputText :model-value="auth.profile?.email" type="email" disabled />
          </div>
          <div class="field">
            <label class="mf-label">ROLE</label>
            <InputText :model-value="auth.profile?.role?.toUpperCase()" disabled />
          </div>
        </div>
        <div v-if="profileMsg" class="feedback" :class="profileMsg.type">
          <i :class="profileMsg.type === 'ok' ? 'pi pi-check' : 'pi pi-exclamation-triangle'" />
          {{ profileMsg.text }}
        </div>
        <div class="form-actions">
          <Button label="SAVE CHANGES" :loading="profileSaving" @click="handleSaveProfile" />
        </div>
      </div>

      <!-- Change password -->
      <div class="card section-card">
        <div class="section-heading">CHANGE PASSWORD</div>
        <div class="form-grid">
          <div class="field">
            <label class="mf-label">CURRENT PASSWORD</label>
            <InputText v-model="pwCurrent" type="password" autocomplete="current-password" />
          </div>
          <div class="field">
            <label class="mf-label">NEW PASSWORD</label>
            <InputText v-model="pwNew" type="password" autocomplete="new-password" />
          </div>
          <div class="field">
            <label class="mf-label">CONFIRM NEW PASSWORD</label>
            <InputText v-model="pwConfirm" type="password" autocomplete="new-password" />
          </div>
        </div>
        <div v-if="pwMsg" class="feedback" :class="pwMsg.type">
          <i :class="pwMsg.type === 'ok' ? 'pi pi-check' : 'pi pi-exclamation-triangle'" />
          {{ pwMsg.text }}
        </div>
        <div class="form-actions">
          <Button label="UPDATE PASSWORD" :loading="pwSaving" :disabled="!pwCurrent || !pwNew || !pwConfirm" @click="handleChangePassword" />
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'

const auth = useAuthStore()

const editName      = ref(auth.profile?.full_name ?? '')
const editBio       = ref(auth.profile?.bio ?? '')
const profileSaving = ref(false)
const profileMsg    = ref<{ type: 'ok' | 'err'; text: string } | null>(null)
const avatarInput   = ref<HTMLInputElement | null>(null)
const avatarUploading = ref(false)

const pwCurrent = ref('')
const pwNew     = ref('')
const pwConfirm = ref('')
const pwSaving  = ref(false)
const pwMsg     = ref<{ type: 'ok' | 'err'; text: string } | null>(null)

const initials = computed(() => {
  const name = auth.profile?.full_name ?? auth.profile?.email ?? 'A'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
})

onMounted(() => {
  editName.value = auth.profile?.full_name ?? ''
  editBio.value  = auth.profile?.bio ?? ''
})

function triggerAvatarPick() {
  avatarInput.value?.click()
}

async function handleAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  avatarUploading.value = true
  const url = await auth.uploadAvatar(file)
  if (url) {
    await auth.updateProfile({ avatar_url: url })
    profileMsg.value = { type: 'ok', text: 'Photo updated.' }
    setTimeout(() => { profileMsg.value = null }, 3000)
  } else {
    profileMsg.value = { type: 'err', text: 'Photo upload failed.' }
  }
  avatarUploading.value = false
  ;(e.target as HTMLInputElement).value = ''
}

async function handleSaveProfile() {
  profileSaving.value = true; profileMsg.value = null
  await auth.updateProfile({
    full_name: editName.value.trim() || null,
    bio: editBio.value.trim() || null,
  })
  profileSaving.value = false
  profileMsg.value = { type: 'ok', text: 'Profile saved.' }
  setTimeout(() => { profileMsg.value = null }, 3000)
}

async function handleChangePassword() {
  pwMsg.value = null
  if (pwNew.value !== pwConfirm.value) { pwMsg.value = { type: 'err', text: 'New passwords do not match.' }; return }
  if (pwNew.value.length < 6) { pwMsg.value = { type: 'err', text: 'Password must be at least 6 characters.' }; return }
  pwSaving.value = true
  const err = await auth.changePassword(pwCurrent.value, pwNew.value)
  pwSaving.value = false
  if (err) { pwMsg.value = { type: 'err', text: err }; return }
  pwMsg.value = { type: 'ok', text: 'Password updated successfully.' }
  pwCurrent.value = ''; pwNew.value = ''; pwConfirm.value = ''
  setTimeout(() => { pwMsg.value = null }, 3000)
}
</script>

<style scoped>
.page { padding: 2rem; max-width: 640px; }
.page-header { margin-bottom: 1.75rem; }
.page-title { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 900; color: #F0F0F0; letter-spacing: 0.05em; }
.page-sub   { font-size: 0.75rem; color: #636366; margin-top: 0.2rem; }

.sections { display: flex; flex-direction: column; gap: 1.25rem; }

.section-card { padding: 1.5rem; }
.section-heading { font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em; color: #636366; margin-bottom: 1.25rem; }

/* Avatar */
.avatar-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; }
.avatar-wrap {
  position: relative; width: 72px; height: 72px; cursor: pointer; flex-shrink: 0;
  transition: opacity 0.15s;
}
.avatar-wrap.uploading { opacity: 0.5; pointer-events: none; }
.avatar-img { width: 72px; height: 72px; object-fit: cover; display: block; }
.avatar-placeholder {
  width: 72px; height: 72px; background: #4A9EFF;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Barlow Condensed', sans-serif; font-size: 1.5rem; font-weight: 900; color: #fff;
}
.avatar-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 1.1rem; opacity: 0; transition: opacity 0.15s;
}
.avatar-wrap:hover .avatar-overlay { opacity: 1; }
.avatar-file-input { display: none; }
.avatar-hint { font-size: 0.72rem; color: #636366; }

.form-grid { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }

.feedback { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; padding: 0.6rem 0.75rem; margin-top: 0.75rem; }
.feedback.ok  { color: #2EAF52; background: rgba(0,166,81,0.08); border: 1px solid rgba(0,166,81,0.25); }
.feedback.err { color: #4A9EFF; background: rgba(74,158,255,0.08); border: 1px solid rgba(74,158,255,0.2); }

.form-actions { margin-top: 1.25rem; }

</style>
