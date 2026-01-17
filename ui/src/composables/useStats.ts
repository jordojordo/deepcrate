import { ref, computed, onMounted } from 'vue';
import * as queueApi from '@/services/queue';
import * as downloadsApi from '@/services/downloads';
import type { QueueStats } from '@/services/queue';
import { useQueueStore } from '@/stores/queue';
import { useDownloadsStore } from '@/stores/downloads';

interface CombinedStats extends QueueStats {
  activeDownloads?: number;
}

export function useStats() {
  const queueStore = useQueueStore();
  const downloadsStore = useDownloadsStore();

  // Internal state for API-fetched values (approved, rejected, etc.)
  const apiStats = ref<QueueStats>({
    pending:        0,
    approved:       0,
    rejected:       0,
    inLibrary:      0,
    approvedToday:  0,
    totalProcessed: 0,
  });
  const loading = ref(true);
  const error = ref<string | null>(null);

  // Track whether stores have been initialized with API data
  const initialized = ref(false);

  // Computed stats that derive pending/active from stores (updated via WebSocket)
  // Falls back to API-fetched values until stores are initialized
  const stats = computed<CombinedStats>(() => ({
    ...apiStats.value,
    // Use store values for real-time updates via WebSocket
    // Fall back to apiStats if store hasn't been populated yet
    pending:         initialized.value ? queueStore.total : apiStats.value.pending,
    activeDownloads: downloadsStore.stats?.active ?? downloadsStore.activeTotal,
  }));

  async function fetchStats() {
    loading.value = true;
    error.value = null;
    try {
      const [queueStats, downloadStats] = await Promise.all([
        queueApi.getStats(),
        downloadsApi.getStats().catch(() => null),
      ]);

      apiStats.value = queueStats;

      // Initialize store values from API fetch
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

  onMounted(() => {
    fetchStats();
  });

  return {
    stats,
    loading,
    error,
    fetchStats,
  };
}
