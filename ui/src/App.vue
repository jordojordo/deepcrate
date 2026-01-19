<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useSidebarItems } from '@/composables/useSidebarItems';
import { ROUTE_PATHS } from '@/constants/routes';

import Button from 'primevue/button';
import Toast from 'primevue/toast';

import AppShell from '@/components/layout/AppShell.vue';
import ThemeToggle from '@/components/common/ThemeToggle.vue';

const authStore = useAuthStore();
const router = useRouter();

const { sidebarTopItems, sidebarBottomItems } = useSidebarItems();

const isAuthed = computed(() => authStore.isAuthenticated);

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
          <img
            src="@/assets/images/bars.png"
            alt="Resonance logo"
            class="sidebar__logo"
          >
        </div>
        <div class="sidebar__branding">
          <span class="sidebar__title">Resonance</span>
          <!-- TODO: Implement version number -->
           <!-- <span class="sidebar__version">v2.4.0</span>  -->
        </div>
      </RouterLink>
    </template>

    <template #header-right>
      <Button
        v-if="isAuthed"
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
    background: linear-gradient(135deg, var(--primary-500, #2b2bee) 0%, #6366f1 100%);
    border-radius: 0.75rem;
    box-shadow: 0 4px 12px rgba(43, 43, 238, 0.3);
  }

  &__logo {
    width: 24px;
    height: 24px;
    object-fit: contain;
    filter: brightness(0) invert(1);
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
