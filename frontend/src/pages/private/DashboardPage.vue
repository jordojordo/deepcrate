<script setup lang="ts">
import { RouterLink } from 'vue-router'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Button from 'primevue/button'
import StatsCard from '@/components/common/StatsCard.vue'
import { useStats } from '@/composables/useStats'
import { ROUTE_PATHS } from '@/constants/routes'

const { stats, loading, error } = useStats()
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-color">Dashboard</h1>
      <p class="mt-1 text-muted">Overview of your music queue activity</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-content-center py-8">
      <ProgressSpinner style="width: 64px; height: 64px" />
    </div>

    <!-- Error State -->
    <Message v-else-if="error" severity="error" :closable="false">{{ error }}</Message>

    <!-- Stats Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatsCard title="Pending Items" :value="stats.pending" color="orange">
        <template #icon>
          <i class="pi pi-clock text-2xl text-orange-500"></i>
        </template>
      </StatsCard>

      <StatsCard title="Approved Today" :value="stats.approvedToday" color="green">
        <template #icon>
          <i class="pi pi-check-circle text-2xl text-green-500"></i>
        </template>
      </StatsCard>

      <StatsCard title="Total Processed" :value="stats.totalProcessed" color="blue">
        <template #icon>
          <i class="pi pi-chart-bar text-2xl text-blue-500"></i>
        </template>
      </StatsCard>
    </div>

    <!-- Quick Actions -->
    <div class="mt-6">
      <h2 class="text-lg font-semibold text-color mb-4">Quick Actions</h2>
      <div class="flex flex-wrap gap-3">
        <RouterLink :to="ROUTE_PATHS.QUEUE">
          <Button label="Review Queue" icon="pi pi-list" />
        </RouterLink>
      </div>
    </div>
  </div>
</template>
