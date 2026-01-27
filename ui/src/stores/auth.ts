import type { AuthConfig, AuthMode } from '@/types/auth';

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

import { fetchAuthConfig, fetchCurrentUser } from '@/services/auth';
import client from '@/services/api';

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false);
  const username = ref<string | null>(null);
  const authConfig = ref<AuthConfig | null>(null);
  const configLoaded = ref(false);

  const requiresLogin = computed(() => {
    if (!authConfig.value) {
      return true;
    }
    if (!authConfig.value.enabled) {
      return false;
    }

    return authConfig.value.type === 'basic' || authConfig.value.type === 'api_key';
  });

  const authMode = computed<AuthMode>(() => {
    if (!authConfig.value?.enabled) {
      return 'disabled';
    }

    return authConfig.value.type;
  });

  async function loadAuthConfig(): Promise<AuthConfig> {
    try {
      authConfig.value = await fetchAuthConfig();
      configLoaded.value = true;
      // Store auth mode for API service to use
      localStorage.setItem('auth_mode', authConfig.value.enabled ? authConfig.value.type : 'disabled');

      return authConfig.value;
    } catch {
      // Default to basic auth if config fetch fails
      authConfig.value = { enabled: true, type: 'basic' };
      configLoaded.value = true;
      localStorage.setItem('auth_mode', 'basic');

      return authConfig.value;
    }
  }

  async function initialize(): Promise<void> {
    await loadAuthConfig();

    if (!authConfig.value?.enabled || authConfig.value.type === 'proxy') {
      await autoAuthenticate();

      return;
    }

    if (authConfig.value.type === 'basic') {
      const storedUsername = localStorage.getItem('auth_username');
      const storedCredentials = localStorage.getItem('auth_credentials');

      if (storedUsername && storedCredentials) {
        isAuthenticated.value = true;
        username.value = storedUsername;
      }
    } else if (authConfig.value.type === 'api_key') {
      const storedApiKey = localStorage.getItem('auth_api_key');

      if (storedApiKey) {
        // Verify the API key is still valid
        try {
          const user = await fetchCurrentUser({ Authorization: `Bearer ${ storedApiKey }` });

          isAuthenticated.value = true;
          username.value = user.username;
        } catch {
          // API key is invalid, clear it
          localStorage.removeItem('auth_api_key');
        }
      }
    }
  }

  /**
   * Auto-authenticate for disabled/proxy modes
   */
  async function autoAuthenticate(): Promise<void> {
    try {
      const user = await fetchCurrentUser();

      isAuthenticated.value = true;
      username.value = user.username;
    } catch {
      // For disabled mode, still mark as authenticated
      if (!authConfig.value?.enabled) {
        isAuthenticated.value = true;
        username.value = 'Guest';
      }
    }
  }

  async function loginBasic(user: string, password: string): Promise<boolean> {
    const credentials = btoa(`${ user }:${ password }`);

    try {
      const response = await client.get('/queue/pending', {
        params:  { limit: 1 },
        headers: { Authorization: `Basic ${ credentials }` },
      });

      if (response.status === 200) {
        localStorage.setItem('auth_credentials', credentials);
        localStorage.setItem('auth_username', user);
        isAuthenticated.value = true;
        username.value = user;

        return true;
      }
    } catch {
      // Authentication failed
    }

    return false;
  }


  async function loginApiKey(apiKey: string): Promise<boolean> {
    try {
      const user = await fetchCurrentUser({ Authorization: `Bearer ${ apiKey }` });

      localStorage.setItem('auth_api_key', apiKey);
      isAuthenticated.value = true;
      username.value = user.username;

      return true;
    } catch {
      // Authentication failed
    }

    return false;
  }

  async function login(userOrKey: string, password?: string): Promise<boolean> {
    if (authConfig.value?.type === 'api_key') {
      return loginApiKey(userOrKey);
    }

    // Default to basic
    return loginBasic(userOrKey, password || '');
  }

  function logout(): void {
    localStorage.removeItem('auth_credentials');
    localStorage.removeItem('auth_username');
    localStorage.removeItem('auth_api_key');
    isAuthenticated.value = false;
    username.value = null;
  }

  return {
    isAuthenticated,
    username,
    authConfig,
    configLoaded,

    requiresLogin,
    authMode,

    initialize,
    loadAuthConfig,
    login,
    loginBasic,
    loginApiKey,
    logout,
  };
});
