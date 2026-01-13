import type { RouteRecordRaw } from 'vue-router';

import { ROUTE_PATHS, ROUTE_NAMES } from '@/constants/routes';

export const routes: RouteRecordRaw[] = [
  // public
  //
  // TODO: Make home page
  // {
  //   path:      '/',
  //   name:      'home',
  //   meta:      { guestOnly: true, breadcrumb: 'Home' },
  //   component: () => import('@/pages/public/HomePage.vue'),
  // },
  {
    path:      ROUTE_PATHS.LOGIN,
    name:      ROUTE_NAMES.LOGIN,
    meta:      { guestOnly: true },
    component: () => import('@/pages/public/LoginPage.vue'),
  },

  // private
  {
    path:      ROUTE_PATHS.DASHBOARD,
    name:      ROUTE_NAMES.DASHBOARD,
    meta:      { requiresAuth: true },
    component: () => import('@/pages/private/DashboardPage.vue'),
  },
  {
    path:      ROUTE_PATHS.QUEUE,
    name:      ROUTE_NAMES.QUEUE,
    component: () => import('@/pages/private/QueuePage.vue'),
    meta:      { requiresAuth: true },
  },

  // 404
  {
    path:      '/:pathMatch(.*)*',
    name:      'not-found',
    component: () => import('@/pages/public/NotFound.vue'),
  },
];
