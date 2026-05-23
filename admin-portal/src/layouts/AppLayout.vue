<template>
  <div class="shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-max">MAX</span>
        <span class="brand-fit">FITNESS</span>
        <span class="brand-admin">{{ auth.isTrainer ? 'TRAINER' : 'ADMIN' }}</span>
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
            <div class="admin-name">{{ auth.profile?.full_name ?? 'Admin' }}</div>
            <div class="admin-email">{{ auth.profile?.email }}</div>
          </div>
        </router-link>
        <button class="signout-btn" @click="handleSignOut" title="Sign out">
          <i class="pi pi-sign-out" />
        </button>
      </div>
    </aside>

    <!-- Main -->
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

const adminNav = [
  { to: '/dashboard',         icon: 'pi pi-chart-bar',    label: 'Dashboard'    },
  { to: '/users',             icon: 'pi pi-users',        label: 'Users'        },
  { to: '/exercises',         icon: 'pi pi-bolt',         label: 'Exercises'    },
  { to: '/trainers',          icon: 'pi pi-id-card',      label: 'Trainers'     },
  { to: '/my-plans',          icon: 'pi pi-list',         label: 'My Plans'     },
  { to: '/templates',         icon: 'pi pi-copy',         label: 'Templates'    },
  { to: '/analytics',         icon: 'pi pi-chart-line',   label: 'Analytics'    },
]

const trainerNav = [
  { to: '/trainer/clients',      icon: 'pi pi-users',      label: 'My Clients'   },
  { to: '/trainer/plan-builder', icon: 'pi pi-list-check', label: 'Plan Builder' },
  { to: '/trainer/checkins',     icon: 'pi pi-check-square', label: 'Check-ins'  },
]

const navItems = computed(() => auth.isTrainer ? trainerNav : adminNav)

const initials = computed(() => {
  const name = auth.profile?.full_name ?? auth.profile?.email ?? 'A'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
})

async function handleSignOut() {
  await auth.signOut()
  router.push('/auth')
}
</script>

<style scoped>
.shell { display: flex; height: 100vh; overflow: hidden; }

/* Sidebar */
.sidebar {
  width: 220px; flex-shrink: 0;
  background: #0D0D0D; border-right: 1px solid #1A1A1A;
  display: flex; flex-direction: column;
}

.brand {
  padding: 1.5rem 1.25rem 1.25rem;
  border-bottom: 1px solid #1A1A1A;
  display: flex; align-items: baseline; gap: 0.3rem;
}
.brand-max  { font-family: 'Barlow Condensed', sans-serif; font-size: 1.4rem; font-weight: 900; color: #FF4D00; letter-spacing: 0.05em; }
.brand-fit  { font-family: 'Barlow Condensed', sans-serif; font-size: 1.4rem; font-weight: 900; color: #F0F0F0; letter-spacing: 0.05em; }
.brand-admin { font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em; color: #444; margin-left: 0.25rem; align-self: flex-end; padding-bottom: 0.1rem; }

.nav { flex: 1; padding: 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.15rem; }

.nav-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  font-family: 'Barlow Condensed', sans-serif; font-size: 0.9rem; font-weight: 700; letter-spacing: 0.08em;
  color: #555; text-decoration: none;
  transition: color 0.15s, background 0.15s;
}
.nav-item i { font-size: 0.85rem; width: 16px; text-align: center; }
.nav-item:hover  { color: #888; background: rgba(255,255,255,0.03); }
.nav-item.active { color: #FF4D00; background: rgba(255,77,0,0.08); }

.sidebar-footer {
  padding: 1rem 0.75rem;
  border-top: 1px solid #1A1A1A;
  display: flex; align-items: center; gap: 0.75rem;
}
.admin-info { flex: 1; display: flex; align-items: center; gap: 0.6rem; min-width: 0; text-decoration: none; cursor: pointer; border-radius: 4px; padding: 0.25rem; transition: background 0.15s; }
.admin-info:hover { background: rgba(255,255,255,0.04); }
.admin-avatar { width: 32px; height: 32px; background: #FF4D00; display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed', sans-serif; font-size: 0.85rem; font-weight: 900; color: #fff; flex-shrink: 0; }
.admin-avatar-img { width: 32px; height: 32px; object-fit: cover; flex-shrink: 0; }
.admin-meta { min-width: 0; }
.admin-name  { font-size: 0.78rem; font-weight: 500; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.admin-email { font-size: 0.65rem; color: #444; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.signout-btn { background: none; border: none; color: #444; cursor: pointer; font-size: 0.85rem; padding: 0.25rem; transition: color 0.15s; flex-shrink: 0; }
.signout-btn:hover { color: #FF4D00; }

/* Main content */
.main { flex: 1; overflow-y: auto; background: #0A0A0A; }
</style>
