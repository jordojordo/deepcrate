<script setup lang="ts">
import AppHeader from './AppHeader.vue'
import AppNav from './AppNav.vue'
</script>

<template>
  <div class="min-h-screen surface-ground">
    <AppHeader />
    <AppNav />
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
      <slot />
    </main>
  </div>
</template>
