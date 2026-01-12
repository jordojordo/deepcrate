<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ROUTE_PATHS } from '@/constants/routes'

import Button from 'primevue/button'

const authStore = useAuthStore()
const router = useRouter()

function handleLogout() {
  authStore.logout()
  router.push(ROUTE_PATHS.LOGIN)
}
</script>

<template>
  <header class="surface-card shadow-sm border-bottom-1 surface-border">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-content-between align-items-center h-4rem">
        <div class="flex align-items-center gap-3">
          <div
            class="w-2rem h-2rem bg-gradient border-round flex align-items-center justify-content-center"
          >
            <i class="pi pi-headphones text-white text-xl"></i>
          </div>
          <h1 class="text-xl font-semibold text-color">Resonance</h1>
        </div>

        <div class="flex align-items-center gap-4">
          <span class="text-sm text-muted">
            {{ authStore.username }}
          </span>
          <Button
            label="Logout"
            outlined
            size="small"
            @click="handleLogout"
          />
        </div>
      </div>
    </div>
  </header>
</template>
