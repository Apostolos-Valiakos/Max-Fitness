import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Root: redirect based on role (handled in beforeEach)
    { path: '/', redirect: '/dashboard' },

    {
      path: '/auth',
      name: 'Auth',
      component: () => import('@/views/AuthView.vue'),
      meta: { requiresGuest: true },
    },

    // Shared shell — both admins and trainers land here
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresStaff: true },
      children: [
        // ── Admin-only routes ───────────────────────────────────────────────
        { path: 'dashboard',   name: 'Dashboard',    component: () => import('@/views/DashboardView.vue'),       meta: { adminOnly: true } },
        { path: 'users',       name: 'Users',        component: () => import('@/views/UsersView.vue'),           meta: { adminOnly: true } },
        { path: 'exercises',   name: 'Exercises',    component: () => import('@/views/ExercisesView.vue'),       meta: { adminOnly: true } },
        { path: 'trainers',    name: 'Trainers',     component: () => import('@/views/TrainersView.vue'),        meta: { adminOnly: true } },
        { path: 'analytics',   name: 'Analytics',    component: () => import('@/views/AnalyticsView.vue'),       meta: { adminOnly: true } },
        { path: 'my-plans',    name: 'MyPlans',      component: () => import('@/views/MyPlansView.vue'),         meta: { adminOnly: true } },
        { path: 'templates',   name: 'Templates',    component: () => import('@/views/TemplatesAdminView.vue'),  meta: { adminOnly: true } },
        { path: 'clients/:id', name: 'ClientDetail', component: () => import('@/views/ClientDetailView.vue'),    meta: { adminOnly: true } },

        // ── Trainer routes (also accessible by admins) ──────────────────────
        { path: 'trainer/clients',          name: 'TrainerClients',         component: () => import('@/views/trainer/TrainerClientsView.vue')         },
        { path: 'trainer/clients/:id',      name: 'TrainerClientProgress',  component: () => import('@/views/trainer/TrainerClientProgressView.vue')  },
        { path: 'trainer/plan-builder',     name: 'TrainerPlanBuilder',     component: () => import('@/views/trainer/TrainerPlanBuilderView.vue')     },
        { path: 'trainer/checkins',         name: 'TrainerCheckins',        component: () => import('@/views/trainer/TrainerCheckinsView.vue')        },

        // ── Shared ──────────────────────────────────────────────────────────
        { path: 'account',                  name: 'Account',            component: () => import('@/views/AccountView.vue')                   },
      ],
    },

    { path: '/unauthorized', name: 'Unauthorized', component: () => import('@/views/UnauthorizedView.vue') },
  ],
})

router.beforeEach(async (to) => {
  const { data: { session } } = await supabase.auth.getSession()

  // Logged-in users hitting /auth → redirect to their home
  if (to.meta.requiresGuest && session) {
    const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    return data?.role === 'trainer' ? { name: 'TrainerClients' } : { name: 'Dashboard' }
  }

  if (!to.meta.requiresStaff) return

  // Not logged in → auth page
  if (!session) return { name: 'Auth' }

  // Verify role
  const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  const role = data?.role

  if (role !== 'admin' && role !== 'trainer') return { name: 'Unauthorized' }

  // Trainer trying to reach an admin-only route → their home
  if (to.meta.adminOnly && role !== 'admin') return { name: 'TrainerClients' }

  // Admin hitting root → dashboard (default redirect already handles this)
  // Trainer hitting root → their home
  if (to.path === '/' && role === 'trainer') return { name: 'TrainerClients' }
})

export default router
