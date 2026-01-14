import { ref, onMounted } from 'vue';
import * as queueApi from '@/services/queue';
import * as downloadsApi from '@/services/downloads';
import type { QueueStats } from '@/services/queue';

interface CombinedStats extends QueueStats {
  activeDownloads?: number;
}

export function useStats() {
  const stats = ref<CombinedStats>({
    pending:         0,
    approvedToday:   0,
    totalProcessed:  0,
    activeDownloads: 0,
  });
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function fetchStats() {
    loading.value = true;
    error.value = null;
    try {
      const [queueStats, downloadStats] = await Promise.all([
        queueApi.getStats(),
        downloadsApi.getStats().catch(() => null),
      ]);

      stats.value = {
        ...queueStats,
        activeDownloads: downloadStats?.active ?? 0,
      };
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
