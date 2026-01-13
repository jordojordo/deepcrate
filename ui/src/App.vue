<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useSidebarItems } from '@/composables/useSidebarItems';
import { ROUTE_PATHS } from '@/constants/routes';

import Button from 'primevue/button';
import Toast from 'primevue/toast';

import AppShell from '@/components/layout/AppShell.vue';

const authStore = useAuthStore();
const router = useRouter();

const { sidebarTopItems, sidebarBottomItems } = useSidebarItems();

onMounted(() => {
  authStore.initialize();
});

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
        <!-- TODO: Make logo -->
        <img
          src="@/assets/images/bars.png"
          alt="Resonance logo"
          class="sidebar__logo"
        >
        <span class="sidebar__title">
          Resonance
        </span>
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
    gap: 0.5rem;
    text-decoration: none;
    color: inherit;
  }

  &__logo {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }

  &__title {
    font-weight: 600;
  }
}
</style>
