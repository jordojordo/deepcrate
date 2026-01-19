<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';

import { useStats } from '@/composables/useStats';
import { useDownloads } from '@/composables/useDownloads';
import { useQueueSocket } from '@/composables/useQueueSocket';
import { useDownloadsSocket } from '@/composables/useDownloadsSocket';
import { useJobsSocket } from '@/composables/useJobsSocket';
import { ROUTE_PATHS } from '@/constants/routes';

import ProgressSpinner from 'primevue/progressspinner';
import Button from 'primevue/button';

import DashboardStatsCard from '@/components/dashboard/DashboardStatsCard.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';
import DiscoverySourcesChart from '@/components/dashboard/DiscoverySourcesChart.vue';
import RecentActivityFeed, { type ActivityItem } from '@/components/dashboard/RecentActivityFeed.vue';
import ActionsPanel from '@/components/actions/ActionsPanel.vue';

const {
  stats, loading, error, fetchStats
} = useStats();
const { stats: downloadStats, activeDownloads, fetchActive } = useDownloads();

useQueueSocket();
useDownloadsSocket();
useJobsSocket();

// Fetch active downloads on mount so progress bars can be displayed
// WebSocket will handle real-time updates after initial load
onMounted(() => {
  fetchActive();
});

// TODO: Discovery sources data - API not yet implemented
const discoverySources = computed(() => []);

// TODO: Recent activity - API not yet implemented
const recentActivity = computed<ActivityItem[]>(() => []);

const handleViewAllActivity = () => {
  // TODO: Navigate to activity log page when implemented
  console.log('View all activity clicked');
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
        <Button
          label="Scan Library"
          icon="pi pi-refresh"
          class="dashboard__action-btn"
          outlined
        />
        <RouterLink :to="ROUTE_PATHS.QUEUE" class="no-underline">
          <Button
            label="Review Queue"
            icon="pi pi-list"
            class="dashboard__action-btn--primary"
          />
        </RouterLink>
      </div>
    </header>

    <div v-if="loading && !error" class="flex justify-content-center py-8">
      <ProgressSpinner style="width: 64px; height: 64px" />
    </div>

    <ErrorMessage
      :error="error"
      :loading="loading"
      @retry="fetchStats"
    />

    <div class="mt-8 mb-8">
      <h2 class="text-xl font-bold text-white mb-4">Discovery Jobs</h2>
      <ActionsPanel />
    </div>

    <div class="dashboard__stats-grid">
      <!-- Pending Approvals (Actionable) -->
      <DashboardStatsCard
        title="Pending Approvals"
        :value="stats.pending"
        subtitle="Items awaiting review"
        color="orange"
        icon="pi-list-check"
        :show-pulse="(stats.pending ?? 0) > 0"
        action-label="Review Queue"
        :action-route="ROUTE_PATHS.QUEUE"
      />

      <!-- Active Downloads (Progress) -->
      <DashboardStatsCard
        title="Active Downloads"
        :value="downloadStats?.active ?? 0"
        :speed="downloadStats?.totalBandwidth ?? 0"
        color="primary"
        icon="pi-cloud-download"
        :downloads="activeDownloads"
      />

      <!-- In Library (Duplicates) -->
      <DashboardStatsCard
        title="In Library"
        :value="stats.inLibrary || 0"
        subtitle="Pending items you already own"
        color="green"
        icon="pi-check-circle"
      />

      <!-- Library Storage (Capacity) -->
      <!-- TODO: Implement library storage capacity API -->
      <DashboardStatsCard
        title="Library Storage"
        value="—"
        subtitle="Coming soon"
        color="purple"
        icon="pi-database"
      />
    </div>

    <div class="dashboard__content-row">
      <div class="dashboard__chart-section">
        <DiscoverySourcesChart :sources="discoverySources" />
      </div>

      <div class="dashboard__activity-section">
        <RecentActivityFeed
          :activities="recentActivity"
          @view-all="handleViewAllActivity"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1600px;
  margin: 0 auto;
}

.dashboard__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
}

.dashboard__stats-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

@media (min-width: 768px) {
  .dashboard__stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .dashboard__stats-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.dashboard__content-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 1024px) {
  .dashboard__content-row {
    grid-template-columns: 1.5fr 1fr;
  }
}

.dashboard__chart-section,
.dashboard__activity-section {
  min-height: 400px;
}

/* Button styling */
:deep(.dashboard__action-btn) {
  background: color-mix(in srgb, var(--surface-card) 70%, transparent);
  border: 1px solid var(--border-subtle);
  color: var(--r-text-primary);
}

:deep(.dashboard__action-btn:hover) {
  background: var(--r-hover-bg);
  border-color: var(--r-border-emphasis);
}

:deep(.dashboard__action-btn--primary) {
  background: var(--primary-500);
  border-color: var(--primary-500);
  color: var(--r-text-primary);
  box-shadow: 0 0 15px rgba(43, 43, 238, 0.25);
}

:deep(.dashboard__action-btn--primary:hover) {
  background: var(--primary-600);
  border-color: var(--primary-600);
}
</style>
