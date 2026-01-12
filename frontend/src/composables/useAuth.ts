import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { ROUTE_PATHS } from '@/constants/routes'

export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()

  const isAuthenticated = computed(() => store.isAuthenticated)
  const username = computed(() => store.username)

  async function login(user: string, password: string) {
    const success = await store.login(user, password)
    if (success) {
      await router.push(ROUTE_PATHS.DASHBOARD)
    }
    return success
  }

  async function logout() {
    store.logout()
    await router.push(ROUTE_PATHS.LOGIN)
  }

  return {
    isAuthenticated,
    username,
    login,
    logout,
  }
}
