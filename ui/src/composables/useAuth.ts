import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import { ROUTE_PATHS } from '@/constants/routes';

export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();

  const isAuthenticated = computed(() => store.isAuthenticated);
  const username = computed(() => store.username);
  const authMode = computed(() => store.authMode);
  const authConfig = computed(() => store.authConfig);
  const requiresLogin = computed(() => store.requiresLogin);

  async function login(userOrKey: string, password?: string) {
    const success = await store.login(userOrKey, password);

    if (success) {
      await router.push(ROUTE_PATHS.DASHBOARD);
    }

    return success;
  }

  async function logout() {
    store.logout();
    await router.push(ROUTE_PATHS.LOGIN);
  }

  return {
    isAuthenticated,
    username,
    authMode,
    authConfig,
    requiresLogin,
    login,
    logout,
  };
}
