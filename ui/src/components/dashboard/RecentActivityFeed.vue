<script setup lang="ts">
import type { ActivityItem } from '@/types';

import ActivityTableContent from '@/components/dashboard/ActivityTableContent.vue';
import Button from 'primevue/button';

interface Props {
  activities: ActivityItem[];
  title?:     string;
  maxHeight?: string;
}

withDefaults(defineProps<Props>(), {
  title:     'Recent Activity',
  maxHeight: '400px',
});

defineEmits<{
  viewAll: [];
}>();
</script>

<template>
  <div class="activity-feed glass-panel flex flex-column h-full">
    <div class="flex align-items-center justify-content-between mb-6">
      <h3 class="text-xl font-bold text-white">{{ title }}</h3>
      <Button
        label="View All"
        class="activity-feed__view-all"
        link
        @click="$emit('viewAll')"
      />
    </div>

    <div
      class="overflow-auto pr-2"
      :style="{ maxHeight }"
    >
      <ActivityTableContent :items="activities" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.activity-feed {
  padding: 1.5rem;
  overflow: hidden;
  min-width: 0;

  &__view-all {
    color: var(--r-text-primary);
  }
}

@media (max-width: 768px) {
  .activity-feed {
    padding: .25rem;
  }
}
</style>
