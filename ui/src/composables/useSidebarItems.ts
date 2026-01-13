import type { SidebarItem } from '@/components/layout/AppShell.vue';

import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useStats } from '@/composables/useStats';
import { ROUTE_PATHS, ROUTE_NAMES } from '@/constants/routes';

export const useSidebarItems = () => {
  const authStore = useAuthStore();
  const { stats } = useStats();
  const isAuthed = computed(() => authStore.isAuthenticated);

  const sidebarTopItems = computed<SidebarItem[]>(() => {
    if (!isAuthed.value) {
      return [
        // TODO: Make a Home route for unauthenticated
        // {
        //   key:   'home',
        //   label: 'Home',
        //   to:    { name: 'home' },
        //   icon:  'pi-home',
        // },
      ];
    }

    return [
      {
        key:   ROUTE_NAMES.DASHBOARD,
        label: 'Dashboard',
        to:    ROUTE_PATHS.DASHBOARD,
        icon:  'pi-th-large',
      },
      {
        key:   ROUTE_NAMES.QUEUE,
        label: 'Pending Queue',
        to:    ROUTE_PATHS.QUEUE,
        icon:  'pi-list',
        badge: stats.value?.pending ?? undefined,
      },
      {
        key:   ROUTE_NAMES.DOWNLOADS,
        label: 'Downloads',
        to:    ROUTE_PATHS.DOWNLOADS,
        icon:  'pi-cloud-download',
        // TODO: Add active downloads count badge when downloads page is implemented
      },
    ];
  });

  const sidebarBottomItems = computed<SidebarItem[]>(() => {
    if (!isAuthed.value) {
      return [
        {
          key:   ROUTE_NAMES.DASHBOARD,
          label: 'Login',
          to:    ROUTE_PATHS.LOGIN,
          icon:  'pi-sign-in',
        },
      ];
    }

    return [
      {
        key:   ROUTE_NAMES.SETTINGS,
        label: 'Settings',
        to:    ROUTE_PATHS.SETTINGS,
        icon:  'pi-cog',
        // TODO: Implement settings page with configuration options
      },
    ];
  });

  return { sidebarTopItems, sidebarBottomItems };
};
