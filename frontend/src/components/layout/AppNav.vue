<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { computed } from 'vue'
import { ROUTE_PATHS } from '@/constants/routes'

const route = useRoute()

const navItems = [
  { name: 'Dashboard', path: ROUTE_PATHS.DASHBOARD, icon: 'pi pi-home' },
  { name: 'Queue', path: ROUTE_PATHS.QUEUE, icon: 'pi pi-list' },
]

const isActive = computed(() => (path: string) => {
  return route.path === path
})
</script>

<template>
  <nav class="surface-card border-bottom-1 surface-border">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex gap-4">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          :class="[
            'inline-flex align-items-center px-1 pt-1 pb-3 border-bottom-2 text-sm font-medium transition-colors',
            isActive(item.path)
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-color hover:border-surface-300',
          ]"
        >
          <i :class="['mr-2', item.icon]"></i>
          {{ item.name }}
        </RouterLink>
      </div>
    </div>
  </nav>
</template>
