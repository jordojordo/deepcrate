<script setup lang="ts">
import {
  computed,
  ref,
  watch,
  useSlots,
} from 'vue';
import { useRoute } from 'vue-router';

import SidebarNavList from '@/components/layout/SidebarNavList.vue';
import { useSettings } from '@/composables/useSettings';

export interface SidebarItem {
  key:       string;
  label:     string;
  to:        string;
  /* The icon name from primevue (e.g. `pi-home`, `pi-bars`) */
  icon?:     string;
  /* Optional badge count to display (e.g., pending queue count) */
  badge?:    number | string;
  /* Optional children items */
  children?: SidebarItem[];
}

const props = defineProps<{
  sidebarTopItems:     SidebarItem[];
  sidebarBottomItems?: SidebarItem[];
}>();

const slots = useSlots();
const route = useRoute();
const { uiPreferences } = useSettings();

const mobileSidebarOpen = ref(false);
const sidebarCollapsed = ref(uiPreferences.value.sidebarCollapsed);
const expandedItems = ref<Set<string>>(new Set());

const hasSidebarBottomSlot = computed(() => !!slots['sidebar-bottom']);
const hasSidebarHeaderSlot = computed(() => !!slots['sidebar-header']);
const hasSidebarFooterSlot = computed(() => !!slots['sidebar-footer']);
const hasHeaderLeftSlot = computed(() => !!slots['header-left']);
const hasHeaderRightSlot = computed(() => !!slots['header-right']);

function closeSidebar() {
  mobileSidebarOpen.value = false;
}

function toggleSidebar() {
  mobileSidebarOpen.value = !mobileSidebarOpen.value;
}

function toggleCollapse() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function toggleExpanded(itemKey: string) {
  if (expandedItems.value.has(itemKey)) {
    expandedItems.value.delete(itemKey);
  } else {
    expandedItems.value.add(itemKey);
  }
}

function isItemExpanded(itemKey: string): boolean {
  return expandedItems.value.has(itemKey);
}

function isItemActive(item: SidebarItem): boolean {
  if (item.to && route.path === item.to) {
    return true;
  }

  return false;
}

function isItemOrDescendantActive(item: SidebarItem): boolean {
  // Item itself matches the current route
  if (isItemActive(item)) {
    return true;
  }

  if (!item.children) {
    return false;
  }

  // Any child (or deeper grandchild) matches
  return item.children.some((child) => {
    if (isItemActive(child)) {
      return true;
    }

    if (child.children) {
      return isItemOrDescendantActive(child);
    }

    return false;
  });
}

// Auto-expand parent items when their children are active
watch(
  () => route.fullPath,
  () => {
    closeSidebar();

    const allItems = [...props.sidebarTopItems, ...(props.sidebarBottomItems || [])];

    allItems.forEach(item => {
      if (item.children && isItemOrDescendantActive(item)) {
        expandedItems.value.add(item.key);
      }
    });
  },
  { immediate: true }
);
</script>

<template>
  <div class="shell">
    <!-- Mobile overlay -->
    <div
      v-if="mobileSidebarOpen"
      class="shell__overlay"
      @click="closeSidebar"
    />

    <!-- LEFT SIDEBAR -->
    <aside
      class="shell__sidebar"
      :class="{
        'sidebar-open': mobileSidebarOpen,
        'sidebar-collapsed': sidebarCollapsed,
      }"
    >
      <div class="shell__sidebar-inner" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
        <!-- Sidebar header (logo / title) -->
        <header
          v-if="hasSidebarHeaderSlot"
          class="shell__sidebar-header"
          :class="{
            'sidebar-collapsed': sidebarCollapsed,
          }"
        >
          <div class="shell__sidebar-header-content">
            <slot name="sidebar-header" />
          </div>
          <button
            type="button"
            class="shell__collapse-toggle"
            :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            @click="toggleCollapse"
          >
            <i class="pi pi-bars" />
          </button>
        </header>

        <!-- Sidebar top navigation -->
        <nav class="shell__sidebar-section shell__sidebar-top">
          <slot name="sidebar-top">
            <SidebarNavList
              :items="sidebarTopItems"
              :sidebar-collapsed="sidebarCollapsed"
              :is-item-expanded="isItemExpanded"
              :toggle-expanded="toggleExpanded"
            />
          </slot>
        </nav>

         <div
          v-if="sidebarTopItems.length > 0 && sidebarBottomItems?.length"
          class="shell__sidebar-level-divider"
          role="separator"
        />

        <!-- Sidebar bottom navigation -->
        <nav
          v-if="hasSidebarBottomSlot || (sidebarBottomItems && sidebarBottomItems.length > 0)"
          class="shell__sidebar-section shell__sidebar-bottom"
        >
          <slot name="sidebar-bottom">
            <SidebarNavList
              v-if="sidebarBottomItems"
              :items="sidebarBottomItems"
              :sidebar-collapsed="sidebarCollapsed"
              :is-item-expanded="isItemExpanded"
              :toggle-expanded="toggleExpanded"
            />
          </slot>
        </nav>

        <footer
          v-if="hasSidebarFooterSlot"
          class="shell__sidebar-footer"
        >
          <slot name="sidebar-footer" :sidebar-collapsed="sidebarCollapsed" />
        </footer>
      </div>
    </aside>

    <!-- RIGHT SIDE: HEADER / CONTENT -->
    <div class="shell__main">
      <header class="shell__header">
        <div class="shell__header-left">
          <button
            type="button"
            class="shell__mobile-toggle"
            aria-label="Toggle navigation"
            @click="toggleSidebar"
          >
            <i class="pi pi-bars" />
          </button>

          <slot
            v-if="hasHeaderLeftSlot"
            name="header-left"
          />
        </div>

        <div
          v-if="hasHeaderRightSlot"
          class="shell__header-right"
        >
          <slot name="header-right" />
        </div>
      </header>

      <main class="shell__content">
        <!-- TODO: Implement breadcrumbs when routes become detailed enough to be nested -->
        <!-- <AppBreadcrumbs /> -->
        <slot />
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.shell {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas:
    "sidebar header"
    "sidebar main";
  height: 100vh;
  width: 100%;
  overflow: hidden;
  transition: grid-template-columns 0.3s ease;

  &:has(.shell__sidebar.sidebar-collapsed) {
    grid-template-columns: 70px minmax(0, 1fr);
  }

  /* Overlay for mobile sidebar */
  &__overlay {
    position: fixed;
    inset: 0;
    background: var(--r-overlay-medium);
    z-index: 15;
  }

  &__sidebar {
    grid-area: sidebar;
    display: flex;
    align-items: stretch;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 1rem;
    box-sizing: border-box;
    z-index: 20;
    transition: padding 0.3s ease;
    border-right: 1px solid var(--r-border-emphasis);

    &.sidebar-collapsed {
      align-items: center;
    }
  }

  &__sidebar-inner {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;

    &.sidebar-collapsed {
      width: 2.8rem;
    }
  }

  &__sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 1rem;
    transition: justify-content 0.3s ease;

    .sidebar-collapsed & {
      justify-content: center;
    }
  }

  &__sidebar-header-content {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    transition: display 0.2s ease;

    .sidebar-collapsed & {
      display: none;
      pointer-events: none;
    }
  }

  &__collapse-toggle {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 0.5rem;
    border: none;
    background: transparent;
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.3s ease;

    .sidebar-collapsed & {
      transform: rotate(90deg);
    }
  }

  &__sidebar-footer {
    margin-top: auto;
    padding-top: 1rem;
    width: 100%;
    transition: opacity 0.2s ease;

    .sidebar-collapsed & {
      opacity: 0.8;
    }
  }

  &__sidebar-section {
    display: flex;
    flex-direction: column;
  }

  &__sidebar-top {
    flex-shrink: 0;
    margin-top: 1rem;
  }

  &__sidebar-bottom {
    flex-shrink: 0;
  }

  &__sidebar-spacer {
    flex: 1 1 auto;
  }

  &__sidebar-level-divider {
    background-color: var(--r-hover-bg);
    height: 1px;
    margin: var(--ui-space-80, 24px) auto;
    min-height: 1px;
    width: calc(100% - 32px);
    transition: width 0.3s ease;

    .sidebar-collapsed & {
      width: calc(100% - 8px);
    }
  }

  &__sidebar-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  &__sidebar-item + &__sidebar-item {
    margin-top: 0.25rem;
  }

  &__sidebar-parent {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    position: relative;

    .shell__sidebar-link {
      flex: 1;
    }
  }

  &__expand-toggle {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 0.25rem;
    border: none;
    background: transparent;
    cursor: pointer;
    transition: background-color 0.2s ease;

    i {
      transition: transform 0.2s ease;
      font-size: 0.75rem;

      &.rotated {
        transform: rotate(180deg);
      }
    }

    &:hover {
      background-color: var(--r-hover-bg);
    }
  }

  &__sidebar-children {
    list-style: none;
    margin: 0.25rem 0 0 0;
    padding: 0 0 0 1.5rem;
    border-left: 1px solid var(--r-border-default);
  }

  &__sidebar-item--child {
    margin-top: 0.125rem;
  }

  &__sidebar-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    text-decoration: none;
    transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out, gap 0.3s ease;
    cursor: pointer;
    position: relative;

    &:visited, &:active, &:focus {
      color: unset;
    }

    .sidebar-collapsed & {
      gap: 0;
      justify-content: center;
      padding: 0.5rem;
    }

    &--child {
      padding: 0.375rem 0.75rem;
      font-size: 0.9rem;
    }
  }

  &__sidebar-link-icon {
    flex-shrink: 0;
  }

  &__sidebar-link-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: opacity 0.2s ease;

    .sidebar-collapsed & {
      opacity: 0;
      width: 0;
      overflow: hidden;
    }
  }

  &__sidebar-link.router-link-active,
  &__sidebar-link.is-active {
    background-color: var(--r-active-bg);
    font-weight: 600;
  }

  &__sidebar-link:hover {
    background-color: var(--r-hover-bg);

    .sidebar-collapsed & {
      text-decoration: none;
    }
  }

  &__main {
    grid-area: header / header / main / main;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas:
      "header"
      "main";
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  &__content {
    grid-area: main;
    padding: 1rem;
    box-sizing: border-box;
    overflow: auto;
    border-top-left-radius: 4px;
  }

  &__header {
    grid-area: header;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    box-sizing: border-box;
    z-index: 10;
  }

  &__header-left,
  &__header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__mobile-toggle {
    display: none;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 999px;
    border: 1px solid;
    background: transparent;
    cursor: pointer;
  }

  &__mobile-toggle span {
    display: block;
    width: 60%;
    height: 2px;
    margin: 0 auto;
    border-radius: 999px;
  }
}

@media (max-width: 768px) {
  .shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas:
      "header"
      "main";

    &__sidebar {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      max-width: 75%;
      transform: translateX(-100%);
      transition: transform 0.2s ease-out;
      box-shadow: 0 0 24px rgba(0, 0, 0, 0.4);

      /* Disable collapse functionality on mobile */
      &.sidebar-collapsed {
        padding: 1rem;
      }
    }

    &__sidebar.sidebar-open {
      transform: translateX(0);
    }

    &__mobile-toggle {
      display: inline-flex;
    }

    &__content {
      border-top-left-radius: 0;
    }

    &__collapse-toggle {
      display: none;
    }

    &__sidebar-header-content {
      .sidebar-collapsed & {
        opacity: 1;
        pointer-events: auto;
      }
    }

    &__sidebar-link-label {
      .sidebar-collapsed & {
        opacity: 1;
        width: auto;
        overflow: visible;
      }
    }
  }
}
</style>
