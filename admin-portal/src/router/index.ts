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
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAdmin: true },
      children: [
        { path: 'dashboard',  name: 'Dashboard',  component: () => import('@/views/DashboardView.vue')  },
        { path: 'users',      name: 'Users',       component: () => import('@/views/UsersView.vue')       },
        { path: 'exercises',  name: 'Exercises',   component: () => import('@/views/ExercisesView.vue')   },
        { path: 'trainers',   name: 'Trainers',    component: () => import('@/views/TrainersView.vue')    },
        { path: 'analytics',   name: 'Analytics',    component: () => import('@/views/AnalyticsView.vue')     },
        { path: 'my-plans',   name: 'MyPlans',     component: () => import('@/views/MyPlansView.vue')       },
        { path: 'templates',  name: 'Templates',   component: () => import('@/views/TemplatesAdminView.vue') },
        { path: 'clients/:id', name: 'ClientDetail', component: () => import('@/views/ClientDetailView.vue') },
      ],
    },
    { path: '/unauthorized', name: 'Unauthorized', component: () => import('@/views/UnauthorizedView.vue') },
  ],
})

router.beforeEach(async (to) => {
  const { data: { session } } = await supabase.auth.getSession()

  if (to.meta.requiresGuest && session) return { name: 'Dashboard' }
  if (!to.meta.requiresAdmin) return

  if (!session) return { name: 'Auth' }

  // Verify admin role
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (data?.role !== 'admin') return { name: 'Unauthorized' }
})

export default router
