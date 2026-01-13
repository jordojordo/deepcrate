<script setup lang="ts">
defineProps({
  /* The icon name from primevue (e.g. `pi-home`, `pi-bars`) */
  icon: {
    type:     String,
    required: true
  }
});
</script>

<template>
  <i class="pi" :class="icon"></i>
</template>
