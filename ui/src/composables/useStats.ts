import type { QueueStats } from '@/services/queue';

import { ref, computed, watch } from 'vue';
import * as queueApi from '@/services/queue';
import * as downloadsApi from '@/services/downloads';
import { useQueueStore } from '@/stores/queue';
import { useDownloadsStore } from '@/stores/downloads';
import { useAuthStore } from '@/stores/auth';

interface CombinedStats extends QueueStats {
  activeDownloads?: number;
}

export function useStats() {
  const authStore = useAuthStore();
  const queueStore = useQueueStore();
  const downloadsStore = useDownloadsStore();

  const apiStats = ref<QueueStats>({
    pending:        0,
    approved:       0,
    rejected:       0,
    inLibrary:      0,
    approvedToday:  0,
    totalProcessed: 0,
  });
  const loading = ref(false);
  const error = ref<string | null>(null);

  const initialized = ref(false);

  // Computed stats that derive pending/active from stores via WebSocket
  // Falls back to API-fetched values until stores are initialized
  const stats = computed<CombinedStats>(() => ({
    ...apiStats.value,
    pending:         initialized.value ? queueStore.total : apiStats.value.pending,
    activeDownloads: downloadsStore.stats?.active ?? downloadsStore.activeTotal,
  }));

  async function fetchStats() {
    if (!authStore.isAuthenticated) {
      return;
    }

    loading.value = true;
    error.value = null;
    try {
      const [queueStats, downloadStats] = await Promise.all([
        queueApi.getStats(),
        downloadsApi.getStats().catch(() => null),
      ]);

      apiStats.value = queueStats;

      // This ensures stores have correct values before WebSocket updates
      queueStore.total = queueStats.pending;

      if (downloadStats) {
        downloadsStore.stats = downloadStats;
      }

      initialized.value = true;
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to load stats';
    } finally {
      loading.value = false;
    }
  }

  watch(
    () => authStore.isAuthenticated,
    (isAuthed) => {
      if (!isAuthed) {
        initialized.value = false;
        loading.value = false;
        error.value = null;
        apiStats.value = {
          pending:        0,
          approved:       0,
          rejected:       0,
          inLibrary:      0,
          approvedToday:  0,
          totalProcessed: 0,
        };

        return;
      }

      fetchStats();
    },
    { immediate: true }
  );

  return {
    stats,
    loading,
    error,
    fetchStats,
  };
}
