import { defineStore } from 'pinia'
import { ref } from 'vue'
import client from '@/services/api'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const username = ref<string | null>(null)

  function initialize() {
    const storedUsername = localStorage.getItem('auth_username')
    const storedCredentials = localStorage.getItem('auth_credentials')

    if (storedUsername && storedCredentials) {
      isAuthenticated.value = true
      username.value = storedUsername
    }
  }

  async function login(user: string, password: string): Promise<boolean> {
    const credentials = btoa(`${user}:${password}`)

    try {
      // Test credentials by making a request
      const response = await client.get('/queue/pending', {
        params: { limit: 1 },
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      })

      if (response.status === 200) {
        localStorage.setItem('auth_credentials', credentials)
        localStorage.setItem('auth_username', user)
        isAuthenticated.value = true
        username.value = user
        return true
      }
    } catch {
      // Authentication failed
    }

    return false
  }

  function logout() {
    localStorage.removeItem('auth_credentials')
    localStorage.removeItem('auth_username')
    isAuthenticated.value = false
    username.value = null
  }

  return {
    isAuthenticated,
    username,
    initialize,
    login,
    logout,
  }
})
