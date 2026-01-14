<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import { useStats } from '@/composables/useStats';
import { useDownloads } from '@/composables/useDownloads';
import { ROUTE_PATHS } from '@/constants/routes';

import ProgressSpinner from 'primevue/progressspinner';
import Message from 'primevue/message';
import Button from 'primevue/button';

import DashboardStatsCard from '@/components/dashboard/DashboardStatsCard.vue';
import DiscoverySourcesChart from '@/components/dashboard/DiscoverySourcesChart.vue';
import RecentActivityFeed, { type ActivityItem } from '@/components/dashboard/RecentActivityFeed.vue';
import ActionsPanel from '@/components/actions/ActionsPanel.vue';

const { stats, loading, error } = useStats();
const { stats: downloadStats, activeDownloads } = useDownloads();

// TODO: Discovery sources data (mock for now - will come from API)
const discoverySources = computed(() => [
  {
    label: 'ListenBrainz', value: 45, color: 'var(--primary-500)'
  },
  {
    label: 'Catalog', value: 30, color: 'var(--purple-500)'
  },
  {
    label: 'Manual Import', value: 15, color: 'var(--teal-400)'
  },
  {
    label: 'Other', value: 10, color: 'rgba(255, 255, 255, 0.2)'
  },
]);

// TODO: Recent activity (mock for now - will come from API)
const recentActivity = computed<ActivityItem[]>(() => [
  {
    id:          '1',
    title:       'New album discovered',
    description: 'From ListenBrainz recommendations',
    timestamp:   '2 mins ago',
    type:        'queued',
  },
  {
    id:          '2',
    title:       'System Scan',
    description: 'Completed successfully',
    timestamp:   '1 hr ago',
    type:        'system',
  },
  {
    id:          '3',
    title:       'Album approved',
    description: 'Sent to wishlist',
    timestamp:   '3 hrs ago',
    type:        'approved',
  },
]);

// TODO: Trend bars data (mock)
const artistTrendBars = [40, 60, 30, 80, 50, 90, 75];

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

    <div v-if="loading" class="flex justify-content-center py-8">
      <ProgressSpinner style="width: 64px; height: 64px" />
    </div>

    <Message v-else-if="error" severity="error" :closable="false">{{ error }}</Message>

    <template v-else>
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

        <!-- Artists Discovered (Trend) -->
        <!-- TODO: Implement artist discovered trend API -->
        <!--       What does this even mean? Artists suggested? New artists actually downloaded? -->
         <DashboardStatsCard
          title="Artists Discovered"
          :value="stats.totalProcessed || 0"
          color="green"
          icon="pi-users"
          :trend-bars="artistTrendBars"
        />

        <!-- Library Storage (Capacity) -->
        <!-- TODO: Implement library storage capacity API -->
        <DashboardStatsCard
          title="Library Storage"
          value="2.4"
          unit="TB"
          subtitle="Total used space"
          color="purple"
          icon="pi-database"
          :progress="{ value: 85, label: '85% Capacity' }"
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

      <div class="mt-8">
        <h2 class="text-xl font-bold text-white mb-4">Discovery Jobs</h2>
        <ActionsPanel />
      </div>
    </template>
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
  background: color-mix(in srgb, var(--surface-700) 70%, transparent);
  border: 1px solid var(--border-subtle);
  color: white;
}

:deep(.dashboard__action-btn:hover) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

:deep(.dashboard__action-btn--primary) {
  background: var(--primary-500);
  border-color: var(--primary-500);
  color: white;
  box-shadow: 0 0 15px rgba(43, 43, 238, 0.25);
}

:deep(.dashboard__action-btn--primary:hover) {
  background: var(--primary-600);
  border-color: var(--primary-600);
}
</style>
