<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { useStats } from '@/composables/useStats';
import { useDownloads } from '@/composables/useDownloads';
import { useActivity } from '@/composables/useActivity';
import { useQueueSocket } from '@/composables/useQueueSocket';
import { useDownloadsSocket } from '@/composables/useDownloadsSocket';
import { useJobsSocket } from '@/composables/useJobsSocket';
import { useActivitySocket } from '@/composables/useActivitySocket';
import { ROUTE_PATHS } from '@/constants/routes';

import Button from 'primevue/button';

import DashboardStatsCard from '@/components/dashboard/DashboardStatsCard.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';
// import DiscoverySourcesChart from '@/components/dashboard/DiscoverySourcesChart.vue';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed.vue';
import ActionsPanel from '@/components/actions/ActionsPanel.vue';
import ActivityModal from '@/components/dashboard/ActivityModal.vue';

const {
  stats, loading, error, fetchStats
} = useStats();
const { stats: downloadStats, activeDownloads, fetchActive } = useDownloads();
const { recentItems: recentActivity, fetchRecent } = useActivity();

useQueueSocket();
useDownloadsSocket();
useJobsSocket();
useActivitySocket();

onMounted(() => {
  fetchActive();
  fetchRecent();
});

const activityModalVisible = ref(false);

const handleViewActivity = () => {
  activityModalVisible.value = true;
};
</script>

<template>
  <div class="dashboard">
    <header class="dashboard__header">
      <div>
        <h1 class="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2">
          Dashboard
        </h1>
        <p class="text-white/50 text-lg">System overview and library status</p>
      </div>
      <div class="flex align-items-center gap-3">
        <RouterLink :to="ROUTE_PATHS.QUEUE" class="no-underline">
          <Button
            label="Review Queue"
            icon="pi pi-list"
          />
        </RouterLink>
      </div>
    </header>

    <ErrorMessage
      :error="error"
      :loading="loading"
      @retry="fetchStats"
    />

    <div class="mt-8 mb-8">
      <h2 class="text-xl font-bold text-white mb-4">Discovery Jobs</h2>
      <ActionsPanel />
    </div>

    <div class="dashboard__stats-row">
      <DashboardStatsCard
        :loading="loading"
        title="Pending Approvals"
        :value="stats.pending"
        subtitle="Items awaiting review"
        color="orange"
        icon="pi-list-check"
        :show-pulse="(stats.pending ?? 0) > 0"
        :action-route="ROUTE_PATHS.QUEUE"
      />

      <DashboardStatsCard
        :loading="loading"
        title="Active Downloads"
        :value="downloadStats?.active ?? 0"
        :speed="downloadStats?.totalBandwidth ?? 0"
        color="primary"
        icon="pi-cloud-download"
        :downloads="activeDownloads"
        :action-route="ROUTE_PATHS.DOWNLOADS"
      />

      <!-- Library Storage -->
      <!-- TODO: Implement library storage capacity API -->
      <!-- <DashboardStatsCard
        title="Library Storage"
        value="—"
        color="purple"
        icon="pi-database"
      /> -->
    </div>

    <div class="dashboard__activity-section">
      <!-- TODO: Discovery sources chart - API not yet implemented -->
      <!-- <div class="dashboard__chart-section">
        <DiscoverySourcesChart :sources="discoverySources" />
      </div> -->

      <RecentActivityFeed :activities="recentActivity" @viewAll="handleViewActivity" />
    </div>

    <ActivityModal
      v-if="activityModalVisible"
      :visible="activityModalVisible"
      @close="activityModalVisible = false"
    />
  </div>
</template>

<style lang="scss" scoped>
.dashboard {
  max-width: 1600px;
  margin: 0 auto;

  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  &__stats-row {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;

    @media (min-width: 768px) {
      flex-direction: row;
    }

    > * {
      flex: 1;
      min-width: 0;
    }
  }

  &__activity-section {
    min-height: 400px;
  }
}
</style>
