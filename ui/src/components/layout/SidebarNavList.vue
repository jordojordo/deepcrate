<script setup lang="ts">
import type { SidebarItem } from '@/components/layout/AppShell.vue';

import { RouterLink } from 'vue-router';

import IconShell from '@/components/common/IconShell.vue';

defineProps<{
  items:            SidebarItem[];
  sidebarCollapsed: boolean;
  isItemExpanded:   (itemKey: string) => boolean;
  toggleExpanded:   (itemKey: string) => void;
}>();
</script>

<template>
  <ul class="shell__sidebar-list">
    <li
      v-for="item in items"
      :key="item.key"
      class="shell__sidebar-item"
    >
      <!-- Parent item with children -->
      <template v-if="item.children && item.children.length > 0">
        <div class="shell__sidebar-parent">
          <RouterLink
            v-slot="{ isExactActive, href, navigate }"
            :to="item.to"
            custom
          >
            <a
              :href="href"
              class="shell__sidebar-link has-children"
              :class="{ 'is-active': isExactActive }"
              :title="sidebarCollapsed ? item.label : undefined"
              @click="navigate"
            >
              <IconShell
                v-if="item.icon"
                :icon="item.icon"
                class="shell__sidebar-link-icon"
              />
              <span class="shell__sidebar-link-label">
                {{ item.label }}
              </span>
            </a>
          </RouterLink>
          <button
            v-if="!sidebarCollapsed"
            type="button"
            class="shell__expand-toggle"
            :aria-label="isItemExpanded(item.key) ? 'Collapse' : 'Expand'"
            @click="toggleExpanded(item.key)"
          >
            <i
              class="pi pi-chevron-down"
              :class="{ 'rotated': isItemExpanded(item.key) }"
            />
          </button>
        </div>

        <!-- Children items -->
        <ul
          v-if="isItemExpanded(item.key) && !sidebarCollapsed"
          class="shell__sidebar-children"
        >
          <li
            v-for="child in item.children"
            :key="child.key"
            class="shell__sidebar-item shell__sidebar-item--child"
          >
            <RouterLink
              v-slot="{ isExactActive, href, navigate }"
              :to="child.to"
              custom
            >
              <a
                :href="href"
                class="shell__sidebar-link shell__sidebar-link--child"
                :class="{ 'is-active': isExactActive }"
                :title="child.label"
                @click="navigate"
              >
                <IconShell
                  v-if="child.icon"
                  :icon="child.icon"
                  class="shell__sidebar-link-icon"
                />
                <span class="shell__sidebar-link-label">
                  {{ child.label }}
                </span>
              </a>
            </RouterLink>
          </li>
        </ul>
      </template>

      <!-- Regular item without children -->
      <RouterLink
        v-else
        v-slot="{ isExactActive, href, navigate }"
        :to="item.to"
        custom
      >
        <a
          :href="href"
          class="shell__sidebar-link"
          :class="{ 'is-active': isExactActive }"
          :title="sidebarCollapsed ? item.label : undefined"
          @click="navigate"
        >
          <IconShell
            v-if="item.icon"
            :icon="item.icon"
            class="shell__sidebar-link-icon"
          />
          <span class="shell__sidebar-link-label">
            {{ item.label }}
          </span>
          <span
            v-if="item.badge !== undefined && !sidebarCollapsed"
            class="shell__sidebar-badge"
          >
            {{ item.badge }}
          </span>
        </a>
      </RouterLink>
    </li>
  </ul>
</template>

<style lang="scss" scoped>
.shell__sidebar-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.shell__sidebar-item + .shell__sidebar-item {
  margin-top: 0.25rem;
}

.shell__sidebar-parent {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  position: relative;

  .shell__sidebar-link {
    flex: 1;
  }
}

.shell__expand-toggle {
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

.shell__sidebar-children {
  list-style: none;
  margin: 0.25rem 0 0 0;
  padding: 0 0 0 1.5rem;
  border-left: 1px solid var(--r-border-default);
}

.shell__sidebar-item--child {
  margin-top: 0.125rem;
}

.shell__sidebar-link {
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

  &--child {
    padding: 0.375rem 0.75rem;
    font-size: 0.9rem;
  }
}

.shell__sidebar-link-icon {
  flex-shrink: 0;
}

.shell__sidebar-link-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 0.2s ease;
}

.shell__sidebar-link.is-active {
  background-color: var(--r-active-bg);
  font-weight: 600;
}

.shell__sidebar-link:hover {
  background-color: var(--r-hover-bg);
}

.shell__sidebar-badge {
  margin-left: auto;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--r-overlay-medium);
  color: var(--p-button-primary-color);
  border-radius: 9999px;
  min-width: 1.25rem;
  text-align: center;
}
</style>
