<script setup lang="ts">
// TODO: Implement downloads page with the following features:
// - Active downloads table with progress bars
// - Stats cards (Active Tasks, Bandwidth, Queue Depth)
// - Search/filter toolbar
// - Integrate with slskd API for real-time status
// - WebSocket connection for live progress updates
</script>

<template>
  <div class="downloads-page">
    <header class="downloads-page__header">
      <div>
        <h1 class="downloads-page__title">Active Downloads</h1>
        <p class="downloads-page__subtitle">
          Monitor and manage your active download queue.
        </p>
      </div>
    </header>

    <div class="downloads-page__placeholder">
      <div class="downloads-page__icon">
        <i class="pi pi-cloud-download"></i>
      </div>
      <h2 class="downloads-page__placeholder-title">Coming Soon</h2>
      <p class="downloads-page__placeholder-text">
        The downloads dashboard is under development. This page will display
        real-time download progress, queue management, and bandwidth statistics
        from the slskd integration.
      </p>
      <div class="downloads-page__features">
        <div class="downloads-page__feature">
          <i class="pi pi-list"></i>
          <span>Download Queue</span>
        </div>
        <div class="downloads-page__feature">
          <i class="pi pi-chart-bar"></i>
          <span>Progress Tracking</span>
        </div>
        <div class="downloads-page__feature">
          <i class="pi pi-bolt"></i>
          <span>Bandwidth Stats</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.downloads-page {
  max-width: 1200px;
  margin: 0 auto;
}

.downloads-page__header {
  margin-bottom: 2rem;
}

.downloads-page__title {
  font-size: 2.25rem;
  font-weight: 700;
  color: white;
  margin: 0;
}

.downloads-page__subtitle {
  font-size: 1rem;
  color: var(--surface-300);
  margin: 0.5rem 0 0 0;
}

.downloads-page__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem 2rem;
  background: var(--surface-glass, rgba(21, 21, 37, 0.7));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 1rem;
  min-height: 400px;
}

.downloads-page__icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-500, #2b2bee) 0%, #6366f1 100%);
  border-radius: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 8px 24px rgba(43, 43, 238, 0.3);
}

.downloads-page__icon i {
  font-size: 2.5rem;
  color: white;
}

.downloads-page__placeholder-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin: 0 0 0.75rem 0;
}

.downloads-page__placeholder-text {
  font-size: 1rem;
  color: var(--surface-300);
  margin: 0 0 2rem 0;
  max-width: 480px;
  line-height: 1.6;
}

.downloads-page__features {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.downloads-page__feature {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--surface-700);
  border-radius: 0.75rem;
  color: var(--surface-200);
  font-size: 0.875rem;
  font-weight: 500;
}

.downloads-page__feature i {
  color: var(--primary-400);
}
</style>
