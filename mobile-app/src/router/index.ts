import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

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
      meta: { requiresAuth: true },
      children: [
        { path: 'dashboard',      name: 'Dashboard',      component: () => import('@/views/DashboardView.vue') },
        { path: 'history',        name: 'History',        component: () => import('@/views/HistoryView.vue') },
        { path: 'history/:id',    name: 'SessionDetail',  component: () => import('@/views/SessionDetailView.vue'), props: true },
        { path: 'exercises',      name: 'Exercises',      component: () => import('@/views/ExercisesView.vue') },
        { path: 'exercises/:id',  name: 'ExerciseDetail', component: () => import('@/views/ExerciseDetailView.vue'), props: true },
        { path: 'templates',        name: 'Templates',       component: () => import('@/views/TemplatesView.vue') },
        { path: 'templates/:id',  name: 'TemplateDetail',  component: () => import('@/views/TemplateDetailView.vue'), props: true },
        { path: 'profile',          name: 'Profile',        component: () => import('@/views/ProfileView.vue') },
        { path: 'measurements',     name: 'Measurements',   component: () => import('@/views/MeasurementsView.vue') },
        { path: 'checkin',          name: 'CheckIn',        component: () => import('@/views/CheckInView.vue') },
        { path: 'trainer',          name: 'Trainer',        component: () => import('@/views/trainer/TrainerView.vue') },
        { path: 'trainer/plans',   name: 'TrainerPlans',    component: () => import('@/views/trainer/TrainerPlanBuilderView.vue') },
        { path: 'trainer/checkin', name: 'TrainerCheckin',  component: () => import('@/views/trainer/TrainerCheckinView.vue') },
        { path: 'trainer/client/:clientId', name: 'TrainerClient', component: () => import('@/views/trainer/TrainerClientDetailView.vue'), props: true },
        { path: 'admin',           name: 'Admin',           component: () => import('@/views/AdminView.vue'), meta: { requiresAdmin: true } },
      ],
    },
    {
      path: '/join-gym',
      name: 'JoinGym',
      component: () => import('@/views/JoinGymView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/workout/start',
      name: 'WorkoutStart',
      component: () => import('@/views/WorkoutStartView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/workout/active',
      name: 'WorkoutActive',
      component: () => import('@/views/WorkoutActiveView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/workout/exercise-picker',
      name: 'ExercisePicker',
      component: () => import('@/views/ExercisePickerView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  const loggedIn = !!auth.user
  if (to.meta.requiresAuth && !loggedIn) return { name: 'Auth' }
  if (to.meta.requiresGuest && loggedIn)  return { name: 'Dashboard' }
  if (to.meta.requiresAdmin && auth.profile?.role !== 'admin') return { name: 'Dashboard' }
})

export default router
