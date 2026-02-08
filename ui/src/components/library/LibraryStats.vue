<script setup lang="ts">
import type { LibraryOrganizeStatus } from '@/types';

import DashboardStatsCard from '@/components/dashboard/DashboardStatsCard.vue';

defineProps<{
  loading: boolean;
  status:  LibraryOrganizeStatus | null;
}>();
</script>

<template>
  <div class="library-stats">
    <div class="flex gap-4">
      <DashboardStatsCard
        :loading="loading"
        title="Completed"
        :value="status?.completed ?? 0"
        color="teal"
        icon="pi-check"
      />

      <DashboardStatsCard
        :loading="loading"
        title="Unorganized"
        :value="status?.unorganized ?? 0"
        color="orange"
        icon="pi-inbox"
        :show-pulse="(status?.unorganized ?? 0) > 0"
      />

      <DashboardStatsCard
        :loading="loading"
        title="Organized"
        :value="status?.organized ?? 0"
        color="green"
        icon="pi-folder"
      />
    </div>
  </div>
</template>

<style scoped>
.library-stats {
  margin-bottom: 1.5rem;
}
</style>
