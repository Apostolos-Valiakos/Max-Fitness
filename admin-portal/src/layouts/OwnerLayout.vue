<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-max">MAX</span>
        <span class="brand-fit">FITNESS</span>
        <span class="brand-owner">OWNER</span>
      </div>

      <nav class="nav">
        <router-link v-for="item in navItems" :key="item.to" :to="item.to" class="nav-item" :class="{ active: route.path.startsWith(item.to) }">
          <i :class="item.icon" />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <router-link to="/account" class="admin-info">
          <img v-if="auth.profile?.avatar_url" :src="auth.profile.avatar_url" class="admin-avatar-img" />
          <div v-else class="admin-avatar">{{ initials }}</div>
          <div class="admin-meta">
            <div class="admin-name">{{ auth.profile?.full_name ?? 'Owner' }}</div>
            <div class="admin-email">{{ auth.profile?.email }}</div>
          </div>
        </router-link>
        <button class="signout-btn" @click="handleSignOut" title="Sign out">
          <i class="pi pi-sign-out" />
        </button>
      </div>
    </aside>

    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const route  = useRoute()
const router = useRouter()
const auth   = useAuthStore()

const navItems = [
  { to: '/owner/gyms',    icon: 'pi pi-building',    label: 'Gyms'    },
  { to: '/owner/revenue', icon: 'pi pi-chart-line',  label: 'Revenue' },
]

const initials = computed(() => {
  const name = auth.profile?.full_name ?? auth.profile?.email ?? 'O'
  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
})

async function handleSignOut() {
  await auth.signOut()
  router.push('/auth')
}
</script>

<style scoped>
.shell { display: flex; height: 100vh; overflow: hidden; }

.sidebar {
  width: 220px; flex-shrink: 0;
  background: var(--bg); border-right: 1px solid var(--surface);
  display: flex; flex-direction: column;
}

.brand {
  padding: 1.5rem 1.25rem 1.25rem;
  border-bottom: 1px solid var(--surface);
  display: flex; align-items: baseline; gap: 0.3rem;
}
.brand-max   { font-family: 'Barlow Condensed', sans-serif; font-size: 1.4rem; font-weight: 900; color: var(--accent); letter-spacing: 0.05em; }
.brand-fit   { font-family: 'Barlow Condensed', sans-serif; font-size: 1.4rem; font-weight: 900; color: var(--text); letter-spacing: 0.05em; }
.brand-owner { font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em; color: var(--gold); margin-left: 0.25rem; align-self: flex-end; padding-bottom: 0.1rem; }

.nav { flex: 1; padding: 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.15rem; }

.nav-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.9rem; font-weight: 700; letter-spacing: 0.08em;
  color: var(--muted); text-decoration: none;
  transition: color 0.15s, background 0.15s;
}
.nav-item i { font-size: 0.85rem; width: 16px; text-align: center; }
.nav-item:hover  { color: #AEAEB2; background: rgba(255,255,255,0.03); }
.nav-item.active { color: var(--gold); background: rgba(255,180,0,0.06); }

.sidebar-footer {
  padding: 1rem 0.75rem;
  border-top: 1px solid var(--surface);
  display: flex; align-items: center; gap: 0.75rem;
}
.admin-info { flex: 1; display: flex; align-items: center; gap: 0.6rem; min-width: 0; text-decoration: none; cursor: pointer; border-radius: 4px; padding: 0.25rem; transition: background 0.15s; }
.admin-info:hover { background: rgba(255,255,255,0.04); }
.admin-avatar { width: 32px; height: 32px; background: var(--gold); display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed', sans-serif; font-size: 0.85rem; font-weight: 900; color: #000; flex-shrink: 0; }
.admin-avatar-img { width: 32px; height: 32px; object-fit: cover; flex-shrink: 0; }
.admin-meta { min-width: 0; }
.admin-name  { font-size: 0.78rem; font-weight: 500; color: #AEAEB2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.admin-email { font-size: 0.65rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.signout-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.85rem; padding: 0.25rem; transition: color 0.15s; flex-shrink: 0; }
.signout-btn:hover { color: var(--gold); }

.main { flex: 1; overflow-y: auto; background: var(--bg); }
</style>
