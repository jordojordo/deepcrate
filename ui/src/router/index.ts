import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { routes } from './routes';

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async(to, _from, next) => {
  const authStore = useAuthStore();

  // Ensure auth config is loaded before first navigation
  if (!authStore.configLoaded) {
    await authStore.initialize();
  }

  // For proxy/disabled modes, treat as always authenticated
  const requiresLogin = authStore.requiresLogin;

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Only redirect to login if login is actually required
    if (requiresLogin) {
      next({ name: 'login' });
    } else {
      // For proxy/disabled, allow through
      next();
    }
  } else if (to.name === 'login' && authStore.isAuthenticated) {
    next({ name: 'dashboard' });
  } else {
    next();
  }
});

export default router;
