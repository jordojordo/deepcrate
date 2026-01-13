import type { SidebarItem } from '@/components/layout/AppShell.vue';

import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { ROUTE_PATHS, ROUTE_NAMES } from '@/constants/routes';

export const useSidebarItems = () => {
  const authStore = useAuthStore();
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
        label: 'Queue',
        to:    ROUTE_PATHS.QUEUE,
        icon:  'pi-list',
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
      // TODO: Make settings page for authenticated
      // {
      //   key:   'settings',
      //   label: 'Settings',
      //   to:    { name: 'settings-general' },
      //   icon:  'pi-cog',
      //   // You can also add children to settings if needed
      //   // children: [
      //   //   {
      //   //     key:   'profile',
      //   //     label: 'Profile',
      //   //     to:    { name: 'settings-profile' },
      //   //     icon:  'pi-user',
      //   //   },
      //   //   {
      //   //     key:   'security',
      //   //     label: 'Security',
      //   //     to:    { name: 'settings-security' },
      //   //     icon:  'pi-lock',
      //   //   },
      //   // ],
      // },
    ];
  });

  return { sidebarTopItems, sidebarBottomItems };
};
