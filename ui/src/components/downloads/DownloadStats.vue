<script setup lang="ts">
import type { DownloadStats as DownloadStatsType } from '@/types';

import DashboardStatsCard from '@/components/dashboard/DashboardStatsCard.vue';

interface Props {
  stats: DownloadStatsType | null;
}

defineProps<Props>();
</script>

<template>
  <div class="download-stats">
    <div class="flex gap-4">
      <DashboardStatsCard
        title="Active"
        :value="stats?.active ?? 0"
        color="primary"
        icon="pi-download"
        :show-pulse="(stats?.active ?? 0) > 0"
      />

      <DashboardStatsCard
        title="Queued"
        :value="stats?.queued ?? 0"
        color="orange"
        icon="pi-clock"
      />

      <DashboardStatsCard
        title="Completed"
        :value="stats?.completed ?? 0"
        color="green"
        icon="pi-check-circle"
      />

      <DashboardStatsCard
        title="Failed"
        :value="stats?.failed ?? 0"
        color="purple"
        icon="pi-times-circle"
      />
    </div>
  </div>
</template>

<style scoped>
.download-stats {
  margin-bottom: 2rem;
}
</style>
