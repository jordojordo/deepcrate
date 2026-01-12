<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/layout/AppLayout.vue'
import Toast from 'primevue/toast'

const authStore = useAuthStore()

onMounted(() => {
  authStore.initialize()
})
</script>

<template>
  <Toast />
  <AppLayout v-if="authStore.isAuthenticated">
    <RouterView />
  </AppLayout>
  <RouterView v-else />
</template>
