<script setup lang="ts">
import type { LibrarySyncStats } from '@/types';

import { ref, computed, onMounted } from 'vue';
import { getSyncStats, triggerSync } from '@/services/library';
import { formatRelativeTime } from '@/utils/formatters';

import Button from 'primevue/button';

const stats = ref<LibrarySyncStats | null>(null);
const loading = ref(true);
const syncing = ref(false);
const error = ref(false);

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

const isStale = computed(() => {
  if (!stats.value?.lastSyncedAt) {
    return true;
  }

  const elapsed = Date.now() - new Date(stats.value.lastSyncedAt).getTime();

  return elapsed > STALE_THRESHOLD_MS;
});

const syncTimeLabel = computed(() => {
  if (!stats.value?.lastSyncedAt) {
    return 'Never synced';
  }

  return formatRelativeTime(stats.value.lastSyncedAt);
});

async function fetchStats() {
  try {
    stats.value = await getSyncStats();
    error.value = false;
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}

async function handleSync() {
  syncing.value = true;

  try {
    await triggerSync();
    await fetchStats();
  } finally {
    syncing.value = false;
  }
}

onMounted(fetchStats);
</script>

<template>
  <div v-if="!error" class="library-sync-info">
    <template v-if="loading">
      <span class="library-sync-info__skeleton" />
    </template>

    <template v-else-if="stats">
      <span class="library-sync-info__text">
        <i
          v-if="isStale"
          class="pi pi-exclamation-circle library-sync-info__stale-icon"
          v-tooltip.top="'Library data may be stale'"
        />
        Library: {{ stats.totalAlbums.toLocaleString() }} albums
        <span class="library-sync-info__separator">&middot;</span>
        {{ syncTimeLabel }}
      </span>

      <Button
        class="library-sync-info__sync-btn"
        label="Sync Now"
        icon="pi pi-sync"
        text
        size="small"
        :loading="syncing"
        @click="handleSync"
      />
    </template>
  </div>
</template>

<style scoped>
.library-sync-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: var(--surface-300);
}

.library-sync-info__text {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.library-sync-info__separator {
  margin: 0 0.125rem;
}

.library-sync-info__stale-icon {
  color: var(--orange-400);
  font-size: 0.75rem;
}

.library-sync-info__skeleton {
  display: inline-block;
  width: 14rem;
  height: 0.75rem;
  background: var(--surface-700);
  border-radius: 0.25rem;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

:deep(.library-sync-info__sync-btn) {
  font-size: 0.7rem;
  padding: 0.125rem 0.375rem;
  color: var(--surface-300);
}

:deep(.library-sync-info__sync-btn:hover) {
  color: var(--primary-400);
}
</style>
