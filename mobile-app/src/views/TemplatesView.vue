<template>
  <div class="view">
    <header class="view-header">
      <h1 class="view-title">TEMPLATES</h1>
      <button class="add-btn" @click="handleCreateClick">
        <i class="pi pi-plus" />
      </button>
    </header>

    <!-- Tier limit warning -->
    <div v-if="auth.isFree" class="tier-banner">
      <div class="tier-left">
        <i class="pi pi-lock" />
        <span>Free plan: {{ myTemplates.length }}/{{ templates.FREE_LIMIT }} templates</span>
      </div>
      <button class="upgrade-link" @click="showUpgrade = true">Upgrade</button>
    </div>

    <!-- ── MY TEMPLATES ────────────────────────────────────────────── -->
    <div class="section-label">MY TEMPLATES</div>
    <div v-if="myTemplates.length === 0" class="empty-state">
      <i class="pi pi-copy empty-icon" />
      <p>No templates yet. Create one to speed up your workouts.</p>
    </div>
    <div v-else>
      <!-- Folder groups -->
      <template v-for="[folder, group] in groupedMyTemplates" :key="folder ?? '__none__'">
        <div v-if="folder" class="folder-header" @click="toggleFolder(folder)">
          <i :class="['pi', collapsedFolders.has(folder) ? 'pi-folder' : 'pi-folder-open']" />
          <span>{{ folder }}</span>
          <span class="folder-count">{{ group.length }}</span>
          <i :class="['pi', collapsedFolders.has(folder) ? 'pi-chevron-right' : 'pi-chevron-down', 'folder-chevron']" />
        </div>
        <div v-if="!folder || !collapsedFolders.has(folder)" class="template-list">
          <div v-for="t in group" :key="t.id" class="template-card">
            <div class="t-body" @click="router.push('/templates/'+t.id)">
              <div class="t-name-row">
                <div class="t-name">{{ t.name }}</div>
                <span v-if="t.is_public" class="t-public-badge">LIBRARY</span>
                <span v-else-if="t.assigned_by" class="t-trainer-badge">TRAINER</span>
              </div>
              <div class="t-meta">
                <span v-if="t.notes" class="t-note">{{ t.notes }}</span>
                <span class="t-ex-count" v-if="exerciseCounts[t.id] != null">
                  {{ exerciseCounts[t.id] }} exercise{{ exerciseCounts[t.id] !== 1 ? 's' : '' }}
                </span>
              </div>
            </div>
            <div class="t-actions">
              <button class="t-action" @click.stop="startWorkout(t)" title="Start workout"><i class="pi pi-play" /></button>
              <button class="t-action" @click.stop="router.push('/templates/'+t.id)" title="Edit"><i class="pi pi-list" /></button>
              <button class="t-action" @click.stop="openFolderPicker(t.id, t.folder_name)" title="Move to folder"><i class="pi pi-folder" /></button>
              <button class="t-action danger" @click.stop="deleteTemplate(t.id)" title="Delete"><i class="pi pi-trash" /></button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Folder picker dialog -->
    <Dialog v-model:visible="showFolderDialog" modal header="MOVE TO FOLDER" :style="{ width: '90vw', maxWidth: '360px' }" class="mf-dialog">
      <div class="folder-picker">
        <div class="folder-option" @click="assignFolder(null)">
          <i class="pi pi-times-circle" /> No folder
        </div>
        <div v-for="f in existingFolders" :key="f" class="folder-option" @click="assignFolder(f)">
          <i class="pi pi-folder" /> {{ f }}
        </div>
        <div class="folder-new">
          <input v-model="newFolderName" class="folder-input" placeholder="New folder name..." @keyup.enter="assignFolder(newFolderName.trim())" />
          <button class="folder-create-btn" :disabled="!newFolderName.trim()" @click="assignFolder(newFolderName.trim())">Create</button>
        </div>
      </div>
    </Dialog>

    <!-- ── MY PROGRAM (trainer-assigned plans) ──────────────────── -->
    <template v-if="trainerTemplates.length > 0">
      <div class="section-label" style="margin-top:1.5rem">MY PROGRAM</div>
      <div class="template-list">
        <div v-for="t in trainerTemplates" :key="t.id" class="template-card trainer-card">
          <div class="t-body" @click="router.push('/templates/'+t.id)">
            <div class="t-name-row">
              <div class="t-name">{{ t.name }}</div>
              <span class="t-trainer-badge">TRAINER</span>
            </div>
            <div class="t-meta">
              <span v-if="t.notes" class="t-note">{{ t.notes }}</span>
              <span class="t-ex-count" v-if="exerciseCounts[t.id] != null">
                {{ exerciseCounts[t.id] }} exercise{{ exerciseCounts[t.id] !== 1 ? 's' : '' }}
              </span>
              <span class="t-trainer-by" v-if="t.assigned_by && creatorNames[t.assigned_by]">
                by {{ creatorNames[t.assigned_by] }}
              </span>
            </div>
          </div>
          <div class="t-actions">
            <button class="t-action" @click.stop="startWorkout(t)" title="Start workout"><i class="pi pi-play" /></button>
            <button class="t-action" @click.stop="router.push('/templates/'+t.id)" title="View"><i class="pi pi-eye" /></button>
          </div>
        </div>
      </div>
    </template>

    <!-- ── PROGRAMS (public library templates not owned by me) ────── -->
    <template v-if="libraryTemplates.length > 0">
      <div class="section-label" style="margin-top:1.5rem">PROGRAMS</div>
      <div class="template-list">
        <div v-for="t in libraryTemplates" :key="t.id" class="template-card library-card">
          <div class="t-body" @click="router.push('/templates/'+t.id)">
            <div class="t-name-row">
              <div class="t-name">{{ t.name }}</div>
              <span class="t-creator-badge">{{ creatorNames[t.owner_id] ?? '…' }}</span>
            </div>
            <div class="t-meta">
              <span v-if="t.notes" class="t-note">{{ t.notes }}</span>
              <span class="t-ex-count" v-if="exerciseCounts[t.id] != null">
                {{ exerciseCounts[t.id] }} exercise{{ exerciseCounts[t.id] !== 1 ? 's' : '' }}
              </span>
            </div>
          </div>
          <div class="t-actions">
            <button class="t-action" @click.stop="startWorkout(t)" title="Start workout"><i class="pi pi-play" /></button>
            <button class="t-action" @click.stop="router.push('/templates/'+t.id)" title="Preview"><i class="pi pi-eye" /></button>
            <button class="t-action accent" @click.stop="handleDuplicate(t.id)" title="Save copy"><i class="pi pi-copy" /></button>
          </div>
        </div>
      </div>
    </template>

    <!-- Upgrade dialog -->
    <Dialog v-model:visible="showUpgrade" modal header="UPGRADE YOUR PLAN" :style="{ width: '92vw', maxWidth: '400px' }" class="mf-dialog">
      <div class="upgrade-body">
        <p class="upgrade-sub">You've reached the <strong>3-template limit</strong> on the free plan.</p>
        <div class="upgrade-tiers">
          <div class="upgrade-tier paid">
            <div class="upgrade-tier-name">PAID</div>
            <ul class="upgrade-perks">
              <li>Unlimited templates</li>
              <li>Advanced analytics</li>
              <li>Priority support</li>
            </ul>
          </div>
          <div class="upgrade-tier ultra">
            <div class="upgrade-tier-name">ULTRA</div>
            <ul class="upgrade-perks">
              <li>Everything in Paid</li>
              <li>Personal trainer access</li>
              <li>Trainer-assigned programs</li>
            </ul>
          </div>
        </div>
        <p class="upgrade-cta-note">Contact us or visit the website to upgrade your account.</p>
        <button class="dialog-btn finish" @click="showUpgrade = false">Got it</button>
      </div>
    </Dialog>

    <!-- Create dialog -->
    <Dialog v-model:visible="showDialog" modal header="NEW TEMPLATE" :style="{ width: '92vw', maxWidth: '400px' }" class="mf-dialog">
      <div class="create-form">
        <div class="field"><label>NAME</label><InputText v-model="formName" class="mf-input" placeholder="e.g. Push Day A" /></div>
        <div class="field"><label>NOTES (optional)</label><InputText v-model="formNotes" class="mf-input" placeholder="e.g. Heavy compound focus" /></div>
        <div class="dialog-actions">
          <button class="dialog-btn cancel" @click="showDialog = false">Cancel</button>
          <button class="dialog-btn finish" :disabled="!formName" @click="handleSave">Create</button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import Dialog    from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useTemplateStore } from '@/stores/templateStore'
import { useWorkoutStore }  from '@/stores/workoutStore'
import { useAuthStore }     from '@/stores/authStore'
import { supabase }         from '@/lib/supabase'
import type { WorkoutTemplateDocument } from '@/lib/rxdb/schemas'

const router    = useRouter()
const templates = useTemplateStore()
const workout   = useWorkoutStore()
const auth      = useAuthStore()

const showDialog      = ref(false)
const showUpgrade     = ref(false)
const showFolderDialog = ref(false)
const formName       = ref('')
const formNotes      = ref('')
const exerciseCounts = ref<Record<string, number>>({})
const creatorNames   = ref<Record<string, string>>({})
const collapsedFolders = ref<Set<string>>(new Set())
const folderTargetId   = ref<string | null>(null)
const newFolderName    = ref('')

const myTemplates = computed(() =>
  templates.templates.filter(t => t.owner_id === auth.user?.id)
)
const trainerTemplates = computed(() =>
  templates.templates.filter(t => !!t.assigned_by && t.owner_id !== auth.user?.id)
)
const libraryTemplates = computed(() =>
  templates.templates.filter(t => t.is_public && t.owner_id !== auth.user?.id && !t.assigned_by)
)

// Group myTemplates by folder_name: null → ungrouped (shown without header)
const groupedMyTemplates = computed((): [string | null, typeof myTemplates.value][] => {
  const groups = new Map<string | null, typeof myTemplates.value>()
  groups.set(null, [])
  for (const t of myTemplates.value) {
    const key = t.folder_name ?? null
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }
  // null group first, then alphabetical folders
  const nullGroup = groups.get(null) ?? []
  const folderGroups = Array.from(groups.entries())
    .filter(([k]) => k !== null)
    .sort(([a], [b]) => (a!).localeCompare(b!))
  const result: [string | null, typeof myTemplates.value][] = []
  if (nullGroup.length) result.push([null, nullGroup])
  result.push(...folderGroups as any)
  return result
})

const existingFolders = computed(() =>
  [...new Set(myTemplates.value.map(t => t.folder_name).filter(Boolean))] as string[]
)

function toggleFolder(name: string) {
  if (collapsedFolders.value.has(name)) collapsedFolders.value.delete(name)
  else collapsedFolders.value.add(name)
}

function openFolderPicker(templateId: string, currentFolder: string | null) {
  folderTargetId.value = templateId
  newFolderName.value  = ''
  showFolderDialog.value = true
}

async function assignFolder(name: string | null) {
  if (!folderTargetId.value) return
  const folder = name?.trim() || null
  await templates.moveToFolder(folderTargetId.value, folder)
  showFolderDialog.value = false
  folderTargetId.value   = null
}

onMounted(() => {
  if (auth.user?.id) templates.subscribeToTemplates(auth.user.id)
})

watch(() => templates.templates, async (list) => {
  for (const t of list) {
    if (exerciseCounts.value[t.id] == null) {
      const tes = await templates.getTemplateExercises(t.id)
      exerciseCounts.value[t.id] = tes.length
    }
  }
  const unknownIds = [...new Set([
    ...list.map(t => t.owner_id),
    ...list.map(t => t.assigned_by).filter(Boolean) as string[],
  ].filter(id => id !== auth.user?.id && !creatorNames.value[id]))]
  if (unknownIds.length) {
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', unknownIds)
    for (const p of data ?? []) creatorNames.value[p.id] = p.full_name ?? 'Unknown'
  }
}, { immediate: true })

function handleCreateClick() {
  if (!templates.canCreate()) { showUpgrade.value = true; return }
  formName.value = ''; formNotes.value = ''; showDialog.value = true
}

async function handleSave() {
  const created = await templates.createTemplate(formName.value, formNotes.value || undefined)
  if (created) router.push('/templates/' + created.id)
  showDialog.value = false
}

async function deleteTemplate(id: string) {
  await templates.deleteTemplate(id)
}

async function startWorkout(t: WorkoutTemplateDocument) {
  await workout.startSession(t.name, t.id)
  router.push('/workout/active')
}

async function handleDuplicate(templateId: string) {
  const newId = await templates.duplicateTemplate(templateId)
  router.push('/templates/' + newId)
}
</script>

<style scoped>
.view { padding: 1.5rem 1rem 0; color: #F0F0F0; font-family: 'DM Sans',sans-serif; background: #1C1C1E; min-height: 100vh; padding-bottom: 5rem; }
.view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.view-title { font-family: 'Barlow Condensed',sans-serif; font-size: 1.8rem; font-weight: 900; }
.add-btn { background: #4A9EFF; border: none; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; clip-path: polygon(0 0,100% 0,100% 75%,85% 100%,0 100%); }

.section-label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em; color: #8E8E93; margin-bottom: 0.6rem; }

.tier-banner { display: flex; justify-content: space-between; align-items: center; background: rgba(74,158,255,0.05); border: 1px solid rgba(74,158,255,0.15); padding: 0.65rem 0.9rem; margin-bottom: 1rem; font-size: 0.78rem; color: #8E8E93; }
.tier-left { display: flex; align-items: center; gap: 0.5rem; }
.upgrade-link { background: none; border: none; color: #4A9EFF; font-weight: 600; font-size: 0.75rem; cursor: pointer; padding: 0; }

.empty-state { text-align: center; padding: 2.5rem 1rem; color: #8E8E93; }
.empty-icon { font-size: 2.5rem; color: #636366; display: block; margin-bottom: 0.75rem; }

.template-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem; }
.template-card { display: flex; align-items: center; gap: 0.75rem; background: #1C1C1E; border: 1px solid #252528; padding: 1rem; clip-path: polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%); }
.library-card { border-color: rgba(255,180,0,0.15); }
.trainer-card { border-color: rgba(255,180,0,0.25); background: rgba(255,180,0,0.03); }

.t-body { flex: 1; min-width: 0; cursor: pointer; }
.t-name-row { display: flex; align-items: center; gap: 0.5rem; }
.t-name { font-family: 'Barlow Condensed',sans-serif; font-size: 1.1rem; font-weight: 700; color: #F0F0F0; }
.t-trainer-badge { font-family: 'Barlow Condensed',sans-serif; font-size: 0.55rem; font-weight: 800; letter-spacing: 0.15em; color: #FFB400; background: rgba(255,180,0,0.1); border: 1px solid rgba(255,180,0,0.3); padding: 0.1rem 0.35rem; flex-shrink: 0; }
.t-public-badge { font-family: 'Barlow Condensed',sans-serif; font-size: 0.55rem; font-weight: 800; letter-spacing: 0.15em; color: #4A9EFF; background: rgba(74,158,255,0.1); border: 1px solid rgba(74,158,255,0.3); padding: 0.1rem 0.35rem; flex-shrink: 0; }
.t-creator-badge { font-family: 'Barlow Condensed',sans-serif; font-size: 0.55rem; font-weight: 800; letter-spacing: 0.1em; color: #8E8E93; padding: 0.1rem 0.35rem; flex-shrink: 0; }
.t-meta { display: flex; flex-direction: column; gap: 0.1rem; margin-top: 0.15rem; }
.t-note { font-size: 0.72rem; color: #636366; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t-ex-count { font-size: 0.7rem; color: #8E8E93; }
.t-trainer-by { font-size: 0.68rem; color: #7a6200; }

.t-actions { display: flex; gap: 0.3rem; }
.t-action { background: #252528; border: 1px solid #3A3A3C; color: #8E8E93; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem; transition: all 0.15s; }
.t-action:active { border-color: #4A9EFF; color: #4A9EFF; }
.t-action.danger:active { border-color: #FF0000; color: #FF0000; }
.t-action.accent { color: #FFB400; border-color: rgba(255,180,0,0.25); }
.t-action.accent:active { border-color: #FFB400; }

/* Folder headers */
.folder-header {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 0.25rem; cursor: pointer; margin-bottom: 0.3rem;
  font-family: 'Barlow Condensed',sans-serif; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; color: #AEAEB2;
}
.folder-header:active { color: #4A9EFF; }
.folder-header .pi-folder, .folder-header .pi-folder-open { color: #FFB400; }
.folder-count { background: #252528; border: 1px solid #3A3A3C; font-size: 0.62rem; padding: 0.05rem 0.35rem; color: #636366; }
.folder-chevron { margin-left: auto; font-size: 0.65rem; color: #636366; }

/* Folder picker */
.folder-picker { display: flex; flex-direction: column; gap: 0.4rem; }
.folder-option { display: flex; align-items: center; gap: 0.6rem; padding: 0.75rem 0.5rem; font-size: 0.85rem; color: #AEAEB2; cursor: pointer; border: 1px solid #252528; transition: color 0.15s, border-color 0.15s; }
.folder-option:active { color: #4A9EFF; border-color: #4A9EFF; }
.folder-new { display: flex; gap: 0.4rem; margin-top: 0.3rem; }
.folder-input { flex: 1; background: #252528; border: 1px solid #3A3A3C; color: #F0F0F0; font-size: 0.85rem; padding: 0.55rem 0.65rem; }
.folder-input:focus { outline: none; border-color: #4A9EFF; }
.folder-create-btn { background: #4A9EFF; border: none; color: #fff; font-family: 'Barlow Condensed',sans-serif; font-weight: 700; padding: 0.55rem 0.9rem; cursor: pointer; font-size: 0.82rem; }
.folder-create-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Upgrade dialog */
.upgrade-body { display: flex; flex-direction: column; gap: 1rem; }
.upgrade-sub { font-size: 0.85rem; color: #AEAEB2; line-height: 1.5; }
.upgrade-sub strong { color: #F0F0F0; }
.upgrade-tiers { display: flex; gap: 0.75rem; }
.upgrade-tier { flex: 1; padding: 0.85rem; border: 1px solid #3A3A3C; }
.upgrade-tier.paid { border-color: rgba(74,158,255,0.3); background: rgba(74,158,255,0.04); }
.upgrade-tier.ultra { border-color: rgba(255,180,0,0.3); background: rgba(255,180,0,0.04); }
.upgrade-tier-name { font-family: 'Barlow Condensed',sans-serif; font-size: 0.85rem; font-weight: 800; letter-spacing: 0.15em; margin-bottom: 0.5rem; }
.upgrade-tier.paid .upgrade-tier-name { color: #4A9EFF; }
.upgrade-tier.ultra .upgrade-tier-name { color: #FFB400; }
.upgrade-perks { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.upgrade-perks li { font-size: 0.72rem; color: #8E8E93; }
.upgrade-perks li::before { content: '✓ '; color: #636366; }
.upgrade-cta-note { font-size: 0.75rem; color: #636366; text-align: center; }

/* Create form */
.create-form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field label { font-family: 'Barlow Condensed',sans-serif; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.2em; color: #636366; }
.dialog-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.dialog-btn { flex: 1; border: none; font-family: 'Barlow Condensed',sans-serif; font-weight: 700; letter-spacing: 0.1em; font-size: 0.9rem; padding: 0.75rem; cursor: pointer; }
.dialog-btn.cancel { background: #252528; color: #AEAEB2; }
.dialog-btn.finish { background: #4A9EFF; color: #fff; clip-path: polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%); }
.dialog-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
