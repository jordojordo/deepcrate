import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ROUTE_PATHS, ROUTE_NAMES } from '@/constants/routes'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: ROUTE_PATHS.DASHBOARD,
      name: ROUTE_NAMES.DASHBOARD,
      component: () => import('@/pages/private/DashboardPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: ROUTE_PATHS.QUEUE,
      name: ROUTE_NAMES.QUEUE,
      component: () => import('@/pages/private/QueuePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: ROUTE_PATHS.LOGIN,
      name: ROUTE_NAMES.LOGIN,
      component: () => import('@/pages/public/LoginPage.vue'),
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login' })
  } else if (to.name === 'login' && authStore.isAuthenticated) {
    next({ name: 'dashboard' })
  } else {
    next()
  }
})

export default router
