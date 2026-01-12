import { ref, onMounted } from 'vue'
import * as queueApi from '@/services/queue'
import type { QueueStats } from '@/services/queue'

export function useStats() {
  const stats = ref<QueueStats>({
    pending:        0,
    approvedToday:  0,
    totalProcessed: 0,
  })
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function fetchStats() {
    loading.value = true
    error.value = null
    try {
      stats.value = await queueApi.getStats()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load stats'
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    fetchStats()
  })

  return {
    stats,
    loading,
    error,
    fetchStats,
  }
}
