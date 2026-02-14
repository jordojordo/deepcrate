<script setup lang="ts">
withDefaults(defineProps<{
  width?:  string;
  height?: string;
}>(), {
  width:  '24',
  height: '24',
});
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    :width="width"
    :height="height"
    fill="currentColor"
  >
    <polygon points="16.94 12.49 43.5 12.49 31.06 35.51 4.5 35.51 16.94 12.49"/>
  </svg>
</template>
