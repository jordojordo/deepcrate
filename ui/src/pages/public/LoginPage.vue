<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import { useAuthStore } from '@/stores/auth';
import { ROUTE_PATHS } from '@/constants/routes';

const store = useAuthStore();
const router = useRouter();

const username = ref('');
const password = ref('');
const apiKey = ref('');
const error = ref('');
const loading = ref(false);
const configLoading = ref(true);

const authMode = computed(() => store.authMode);
const showBasicForm = computed(() => authMode.value === 'basic');
const showApiKeyForm = computed(() => authMode.value === 'api_key');
const showAutoAuth = computed(() => authMode.value === 'proxy' || authMode.value === 'disabled');

onMounted(async() => {
  try {
    await store.loadAuthConfig();

    // For proxy/disabled modes, auto-authenticate and redirect
    if (showAutoAuth.value) {
      await store.initialize();

      if (store.isAuthenticated) {
        await router.replace(ROUTE_PATHS.DASHBOARD);
      }
    }
  } catch {
    error.value = 'Failed to load authentication configuration';
  } finally {
    configLoading.value = false;
  }
});

async function handleBasicSubmit() {
  error.value = '';
  loading.value = true;

  try {
    const success = await store.loginBasic(username.value, password.value);

    if (success) {
      await router.push(ROUTE_PATHS.DASHBOARD);
    } else {
      error.value = 'Invalid username or password';
    }
  } catch {
    error.value = 'An error occurred. Please try again.';
  } finally {
    loading.value = false;
  }
}

async function handleApiKeySubmit() {
  error.value = '';
  loading.value = true;

  try {
    const success = await store.loginApiKey(apiKey.value);

    if (success) {
      await router.push(ROUTE_PATHS.DASHBOARD);
    } else {
      error.value = 'Invalid API key';
    }
  } catch {
    error.value = 'An error occurred. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen surface-ground flex align-items-center justify-content-center px-4">
    <div class="max-w-md w-full">
      <!-- Logo -->
      <div class="text-center mb-6">
        <div
          class="logo-container w-4rem h-4rem mx-auto bg-gradient border-round-2xl flex align-items-center justify-content-center mb-4"
        >
          <img
            src="@/assets/images/bars.png"
            alt="Resonance logo"
            class="logo"
          >
        </div>
        <h1 class="text-2xl font-bold text-color">Resonance</h1>
        <p class="mt-2 text-muted">Sign in to manage your music queue</p>
      </div>

      <Card v-if="configLoading">
        <template #content>
          <div class="flex flex-column align-items-center gap-3 py-4">
            <ProgressSpinner style="width: 40px; height: 40px" />
          </div>
        </template>
      </Card>

      <!-- Auto-auth message (proxy/disabled) -->
      <Card v-else-if="showAutoAuth">
        <template #content>
          <div class="flex flex-column align-items-center gap-3 py-4">
            <ProgressSpinner style="width: 40px; height: 40px" />
            <span class="text-muted">
              {{ authMode === 'proxy' ? 'Authenticating via proxy...' : 'Authentication disabled, redirecting...' }}
            </span>
          </div>
        </template>
      </Card>

      <!-- Basic Auth Form -->
      <Card v-else-if="showBasicForm">
        <template #content>
          <form @submit.prevent="handleBasicSubmit" class="flex flex-column gap-4">
            <Message v-if="error" severity="error" :closable="false">
              {{ error }}
            </Message>

            <!-- Username -->
            <div class="flex flex-column gap-2">
              <label for="username" class="text-sm font-medium">Username</label>
              <InputText
                id="username"
                v-model="username"
                type="text"
                required
                autocomplete="username"
                placeholder="Enter your username"
              />
            </div>

            <!-- Password -->
            <div class="flex flex-column gap-2">
              <label for="password" class="text-sm font-medium">Password</label>
              <Password
                id="password"
                v-model="password"
                required
                autocomplete="current-password"
                placeholder="Enter your password"
                :feedback="false"
                toggle-mask
              />
            </div>

            <!-- Submit Button -->
            <Button
              type="submit"
              label="Sign In"
              :loading="loading"
              class="w-full"
            />
          </form>
        </template>
      </Card>

      <!-- API Key Form -->
      <Card v-else-if="showApiKeyForm">
        <template #content>
          <form @submit.prevent="handleApiKeySubmit" class="flex flex-column gap-4">
            <Message v-if="error" severity="error" :closable="false">
              {{ error }}
            </Message>

            <div class="flex flex-column gap-2">
              <label for="apiKey" class="text-sm font-medium">API Key</label>
              <Password
                id="apiKey"
                v-model="apiKey"
                required
                autocomplete="off"
                placeholder="Enter your API key"
                :feedback="false"
                toggle-mask
              />
            </div>

            <Button
              type="submit"
              label="Sign In"
              :loading="loading"
              class="w-full"
            />
          </form>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.logo-container {
  background: linear-gradient(135deg, var(--primary-500, #2b2bee) 0%, #6366f1 100%);
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(43, 43, 238, 0.3);
}

.logo {
  width: 24px;
  height: 24px;
  object-fit: contain;
  filter: brightness(0) invert(1);
}
</style>
