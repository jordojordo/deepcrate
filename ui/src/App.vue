<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useSidebarItems } from '@/composables/useSidebarItems';
import { useToast } from '@/composables/useToast';
import { setToastCallback } from '@/services/api';
import { fetchHealth } from '@/services/health';
import { ROUTE_PATHS } from '@/constants/routes';

import Button from 'primevue/button';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';

import AppShell from '@/components/layout/AppShell.vue';
import ThemeToggle from '@/components/common/ThemeToggle.vue';
import PreviewPlayer from '@/components/player/PreviewPlayer.vue';
import CrateIcon from '@/components/icons/CrateIcon.vue';

const authStore = useAuthStore();
const router = useRouter();
const { showError } = useToast();

const { sidebarTopItems, sidebarBottomItems } = useSidebarItems();

const appVersion = ref<string | undefined>(undefined);
const isAuthed = computed(() => authStore.isAuthenticated);
const requiresLogin = computed(() => authStore.requiresLogin);

onMounted(async() => {
  setToastCallback(showError);

  try {
    const healthCheck = await fetchHealth();

    appVersion.value = healthCheck?.version;
  } catch(error) {
    console.error(error);
  }
});

function handleLogout(): void {
  authStore.logout();

  router.push(ROUTE_PATHS.LOGIN);
}
</script>

<template>
  <AppShell
    :sidebar-top-items="sidebarTopItems"
    :sidebar-bottom-items="sidebarBottomItems"
  >
    <template #sidebar-header>
      <RouterLink
        to="/"
        class="sidebar__header-logo"
      >
        <div class="sidebar__logo-container">
          <CrateIcon
            width="100"
            height="100"
          />
        </div>
        <div class="sidebar__branding">
          <span class="sidebar__title">DeepCrate</span>
          <span v-if="appVersion" class="sidebar__version">v{{ appVersion }}</span>
        </div>
      </RouterLink>
    </template>

    <template #header-right>
      <Button
        v-if="requiresLogin && isAuthed"
        appearance="secondary"
        size="small"
        @click="handleLogout"
      >
        Logout
      </Button>
    </template>

    <template #sidebar-footer="{ sidebarCollapsed }">
      <ThemeToggle :collapsed="sidebarCollapsed" />
    </template>

    <router-view />
  </AppShell>

  <Toast />
  <ConfirmDialog />
  <PreviewPlayer />
</template>

<style lang="scss" scoped>
.sidebar {
  &__header {
    padding: 1rem;
    border-bottom: 1px solid var(--kp-color-border-200);
    margin-bottom: 1rem;
  }

  &__header-logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    text-decoration: none;
    color: inherit;
  }

  &__logo-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    color: var(--r-text-primary);
  }

  &__branding {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  &__title {
    font-weight: 700;
    font-size: 1.125rem;
  }

  &__version {
    font-size: 0.6875rem;
    color: var(--surface-400, #9d9db9);
    font-weight: 500;
    letter-spacing: 0.025em;
  }
}
</style>
