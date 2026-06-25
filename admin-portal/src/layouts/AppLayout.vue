<template>
  <div class="app-wrap">
    <!-- Impersonation banner (owner viewing a gym's admin view) -->
    <div v-if="owner.impersonatingGym" class="impersonation-bar">
      <i class="pi pi-eye" />
      Viewing gym: <strong>{{ owner.impersonatingGym.name }}</strong>
      <button class="exit-impersonate" @click="exitImpersonation">
        <i class="pi pi-times" /> Exit
      </button>
    </div>

  <!-- Subscription locked (admin only) -->
  <div v-if="auth.isAdmin && gymStore.isLocked" class="lockout">
    <div class="lockout-card">
      <i class="pi pi-lock lockout-icon" />
      <h2 class="lockout-title">{{ gymStore.isTrialExpired ? 'TRIAL ENDED' : 'ACCESS SUSPENDED' }}</h2>
      <p class="lockout-body">{{ gymStore.isTrialExpired ? 'Your free trial has expired. Subscribe to a plan to restore full access.' : "Your gym's subscription has lapsed. Renew your plan to restore full access." }}</p>
      <router-link to="/billing" class="lockout-btn">Go to Billing</router-link>
      <button class="lockout-signout" @click="handleSignOut">Sign out</button>
    </div>
  </div>

  <div v-else class="shell">
    <!-- Trial warning banner -->
    <div v-if="auth.isAdmin && gymStore.isTrialing && !gymStore.isTrialExpired" class="trial-bar">
      <i class="pi pi-clock" />
      <template v-if="(gymStore.trialDaysLeft ?? 0) > 0">
        Trial ends in <strong>{{ gymStore.trialDaysLeft }} day{{ gymStore.trialDaysLeft === 1 ? '' : 's' }}</strong> —
      </template>
      <template v-else>
        Trial ends <strong>today</strong> —
      </template>
      <router-link to="/billing" class="trial-link">Subscribe now to keep access →</router-link>
    </div>

    <!-- Past-due warning banner -->
    <div v-if="auth.isAdmin && gymStore.isPastDue" class="warning-bar">
      <i class="pi pi-exclamation-triangle" />
      Payment failed — your subscription is past due.
      <router-link to="/billing" class="warning-link">Update billing →</router-link>
    </div>

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
  </div>
</template>




<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useOwnerStore } from '@/stores/ownerStore'
import { useGymStore } from '@/stores/gymStore'

const route    = useRoute()
const router   = useRouter()
const auth     = useAuthStore()
const owner    = useOwnerStore()
const gymStore = useGymStore()

function exitImpersonation() {
  owner.stopImpersonating()
  router.push('/owner/gyms')
}

const adminNav = [
  { to: '/dashboard',         icon: 'pi pi-chart-bar',    label: 'Dashboard'    },
  { to: '/users',             icon: 'pi pi-users',        label: 'Users'        },
  { to: '/exercises',         icon: 'pi pi-bolt',         label: 'Exercises'    },
  { to: '/trainers',          icon: 'pi pi-id-card',      label: 'Trainers'     },
  { to: '/my-plans',          icon: 'pi pi-list',         label: 'My Plans'     },
  { to: '/templates',         icon: 'pi pi-copy',         label: 'Templates'    },
  { to: '/analytics',         icon: 'pi pi-chart-line',   label: 'Analytics'    },
  { to: '/billing',           icon: 'pi pi-credit-card',  label: 'Billing'      },
  { to: '/settings',          icon: 'pi pi-cog',           label: 'Settings'     },
]

const trainerNav = [
  { to: '/trainer/clients',  icon: 'pi pi-users',        label: 'My Clients' },
  { to: '/templates',        icon: 'pi pi-copy',         label: 'Templates'  },
  { to: '/my-plans',         icon: 'pi pi-list',         label: 'My Plans'   },
  { to: '/trainer/checkins', icon: 'pi pi-check-square', label: 'Check-ins'  },
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
.app-wrap { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

/* Impersonation banner */
.impersonation-bar {
  flex-shrink: 0;
  background: rgba(255,180,0,0.12); border-bottom: 1px solid rgba(255,180,0,0.35);
  color: var(--gold); font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em;
  padding: 0.45rem 1.25rem; display: flex; align-items: center; gap: 0.5rem;
}
.exit-impersonate {
  margin-left: auto; background: rgba(255,180,0,0.15); border: 1px solid rgba(255,180,0,0.4);
  color: var(--gold); font-family: 'Barlow Condensed', sans-serif; font-weight: 700;
  font-size: 0.72rem; letter-spacing: 0.1em; padding: 0.2rem 0.6rem; cursor: pointer;
  transition: background 0.15s; display: flex; align-items: center; gap: 0.35rem;
}
.exit-impersonate:hover { background: rgba(255,180,0,0.25); }

.shell { display: flex; flex: 1; overflow: hidden; }

/* Sidebar */
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
.brand-max  { font-family: 'Barlow Condensed', sans-serif; font-size: 1.4rem; font-weight: 900; color: var(--accent); letter-spacing: 0.05em; }
.brand-fit  { font-family: 'Barlow Condensed', sans-serif; font-size: 1.4rem; font-weight: 900; color: var(--text); letter-spacing: 0.05em; }
.brand-admin { font-family: 'Barlow Condensed', sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em; color: var(--muted); margin-left: 0.25rem; align-self: flex-end; padding-bottom: 0.1rem; }

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
.nav-item.active { color: var(--accent); background: rgba(74,158,255,0.08); }

.sidebar-footer {
  padding: 1rem 0.75rem;
  border-top: 1px solid var(--surface);
  display: flex; align-items: center; gap: 0.75rem;
}
.admin-info { flex: 1; display: flex; align-items: center; gap: 0.6rem; min-width: 0; text-decoration: none; cursor: pointer; border-radius: 4px; padding: 0.25rem; transition: background 0.15s; }
.admin-info:hover { background: rgba(255,255,255,0.04); }
.admin-avatar { width: 32px; height: 32px; background: var(--accent); display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed', sans-serif; font-size: 0.85rem; font-weight: 900; color: #fff; flex-shrink: 0; }
.admin-avatar-img { width: 32px; height: 32px; object-fit: cover; flex-shrink: 0; }
.admin-meta { min-width: 0; }
.admin-name  { font-size: 0.78rem; font-weight: 500; color: #AEAEB2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.admin-email { font-size: 0.65rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.signout-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.85rem; padding: 0.25rem; transition: color 0.15s; flex-shrink: 0; }
.signout-btn:hover { color: var(--accent); }

/* Trial warning banner */
.trial-bar {
  flex-shrink: 0;
  background: rgba(74,158,255,0.08); border-bottom: 1px solid rgba(74,158,255,0.25);
  color: var(--accent); font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em;
  padding: 0.45rem 1.25rem; display: flex; align-items: center; gap: 0.5rem;
}
.trial-link { color: var(--accent); text-decoration: underline; margin-left: 0.25rem; }

/* Past-due warning banner */
.warning-bar {
  flex-shrink: 0;
  background: rgba(255,107,107,0.1); border-bottom: 1px solid rgba(255,107,107,0.35);
  color: var(--danger); font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em;
  padding: 0.45rem 1.25rem; display: flex; align-items: center; gap: 0.5rem;
}
.warning-link { color: var(--danger); text-decoration: underline; margin-left: auto; }

/* Lockout overlay */
.lockout {
  position: fixed; inset: 0; background: var(--bg);
  display: flex; align-items: center; justify-content: center;
  z-index: 999;
}
.lockout-card {
  text-align: center; max-width: 400px; padding: 3rem 2rem;
  border: 1px solid var(--surface);
}
.lockout-icon  { font-size: 2.5rem; color: var(--danger); display: block; margin-bottom: 1.25rem; }
.lockout-title { font-family: 'Barlow Condensed', sans-serif; font-size: 1.6rem; font-weight: 900; color: var(--text); letter-spacing: 0.08em; margin-bottom: 0.75rem; }
.lockout-body  { font-size: 0.85rem; color: var(--sub); line-height: 1.5; margin-bottom: 1.75rem; }
.lockout-btn {
  display: inline-block; background: var(--accent); color: #fff; text-decoration: none;
  font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: 0.1em;
  padding: 0.65rem 1.5rem; clip-path: var(--clip-sm); margin-bottom: 0.75rem;
}
.lockout-signout {
  display: block; margin: 0 auto; background: none; border: none;
  font-size: 0.78rem; color: var(--muted); cursor: pointer;
}
.lockout-signout:hover { color: var(--sub); }

/* Main content */
.main { flex: 1; overflow-y: auto; background: var(--bg); }
</style>
