<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
import { computed } from 'vue'

const props = defineProps<{
  size?: 'sm' | 'md' | 'lg'
}>()

const sizeMap = {
  sm: '24px',
  md: '48px',
  lg: '64px',
}

const spinnerSize = computed(() => sizeMap[props.size || 'md'])
</script>

<template>
  <div class="flex justify-content-center align-items-center">
    <ProgressSpinner
      :style="{ width: spinnerSize, height: spinnerSize }"
      strokeWidth="4"
    />
  </div>
</template>
