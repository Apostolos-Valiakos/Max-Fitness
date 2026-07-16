import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },

    {
      path: '/auth',
      name: 'Auth',
      component: () => import('@/views/AuthView.vue'),
      meta: { requiresGuest: true },
    },

    // ── Owner portal (owner role only) ─────────────────────────────────────
    {
      path: '/owner',
      component: () => import('@/layouts/OwnerLayout.vue'),
      meta: { requiresOwner: true },
      children: [
        { path: '',       redirect: '/owner/gyms' },
        { path: 'gyms',    name: 'OwnerGyms',    component: () => import('@/views/owner/OwnerGymsView.vue')    },
        { path: 'revenue', name: 'OwnerRevenue', component: () => import('@/views/owner/OwnerRevenueView.vue') },
        { path: 'users',   name: 'OwnerUsers',   component: () => import('@/views/owner/OwnerUsersView.vue')   },
      ],
    },

    // ── Shared shell — admin, trainer, and owner (when impersonating) ──────
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresStaff: true },
      children: [
        // Admin-only routes
        { path: 'dashboard',   name: 'Dashboard',    component: () => import('@/views/DashboardView.vue'),       meta: { adminOnly: true } },
        { path: 'users',       name: 'Users',        component: () => import('@/views/UsersView.vue'),           meta: { adminOnly: true } },
        { path: 'exercises',   name: 'Exercises',    component: () => import('@/views/ExercisesView.vue'),       meta: { adminOnly: true } },
        { path: 'trainers',    name: 'Trainers',     component: () => import('@/views/TrainersView.vue'),        meta: { adminOnly: true } },
        { path: 'analytics',   name: 'Analytics',    component: () => import('@/views/AnalyticsView.vue'),       meta: { adminOnly: true } },
        { path: 'my-plans',    name: 'MyPlans',      component: () => import('@/views/MyPlansView.vue')         },
        { path: 'templates',   name: 'Templates',    component: () => import('@/views/TemplatesAdminView.vue')  },
        { path: 'clients/:id', name: 'ClientDetail', component: () => import('@/views/ClientDetailView.vue'),    meta: { adminOnly: true } },

        // Trainer routes (also accessible by admins and owner-impersonating)
        { path: 'trainer/clients',     name: 'TrainerClients',        component: () => import('@/views/trainer/TrainerClientsView.vue')        },
        { path: 'trainer/clients/:id', name: 'TrainerClientProgress', component: () => import('@/views/trainer/TrainerClientProgressView.vue') },
        { path: 'trainer/checkins',    name: 'TrainerCheckins',       component: () => import('@/views/trainer/TrainerCheckinsView.vue')       },

        // Shared
        { path: 'account', name: 'Account',  component: () => import('@/views/AccountView.vue') },
        { path: 'billing',  name: 'Billing',  component: () => import('@/views/BillingView.vue'),      meta: { adminOnly: true } },
        { path: 'settings', name: 'Settings', component: () => import('@/views/GymSettingsView.vue'),  meta: { adminOnly: true } },
      ],
    },

    { path: '/invite/:token', name: 'Invite',       component: () => import('@/views/InviteView.vue') },
    { path: '/unauthorized',  name: 'Unauthorized', component: () => import('@/views/UnauthorizedView.vue') },
  ],
})

router.beforeEach(async (to) => {
  const { data: { session } } = await supabase.auth.getSession()

  // Logged-in users hitting /auth → redirect to their home
  if (to.meta.requiresGuest && session) {
    const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    const role = data?.role
    if (role === 'owner')   return { name: 'OwnerGyms' }
    if (role === 'trainer') return { name: 'TrainerClients' }
    return { name: 'Dashboard' }
  }

  const needsAuth = to.meta.requiresStaff || to.meta.requiresOwner
  if (!needsAuth) return

  if (!session) return { name: 'Auth' }

  const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  const role = data?.role

  // Owner-only routes
  if (to.meta.requiresOwner && role !== 'owner') return { name: 'Unauthorized' }

  // Staff routes: owner, admin, trainer
  if (to.meta.requiresStaff) {
    if (!['admin', 'trainer', 'owner'].includes(role ?? '')) return { name: 'Unauthorized' }

    // Owner hitting staff routes without impersonation → send home
    if (role === 'owner' && to.path === '/') return { name: 'OwnerGyms' }

    // adminOnly: admin or owner (owner can impersonate admin views)
    if (to.meta.adminOnly && role !== 'admin' && role !== 'owner') return { name: 'TrainerClients' }

    // Trainer hitting root → their home
    if (to.path === '/' && role === 'trainer') return { name: 'TrainerClients' }
  }
})

export default router
