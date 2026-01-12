import type { QueueItem, QueueFilters } from '@/types'

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import * as queueApi from '@/services/queue'
import { useToast } from '@/composables/useToast'

export const useQueueStore = defineStore('queue', () => {
  const items = ref<QueueItem[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filters = ref<QueueFilters>({
    source: 'all',
    sort: 'added_at',
    order: 'desc',
    limit: 20,
    offset: 0,
  })

  const hasMore = computed(() => items.value?.length < total.value)

  async function fetchPending(append = false) {
    loading.value = true
    error.value = null

    try {
      const response = await queueApi.getPending(filters.value)
      if (append) {
        items.value = [...items.value, ...response.items]
      } else {
        items.value = response.items
      }
      total.value = response.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch pending items'
    } finally {
      loading.value = false
    }
  }

  async function approve(mbids: string[]) {
    loading.value = true
    error.value = null
    const { showSuccess, showError } = useToast()

    try {
      await queueApi.approve({ mbids })
      // Remove approved items from the list
      items.value = items.value.filter((item) => !mbids.includes(item.mbid))
      total.value = Math.max(0, total.value - mbids.length)
      showSuccess('Items approved', `${mbids.length} item(s) added to wishlist`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to approve items'
      showError('Failed to approve items')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function approveAll() {
    const allMbids = items.value.map((item) => item.mbid)
    await approve(allMbids)
  }

  async function reject(mbids: string[]) {
    loading.value = true
    error.value = null
    const { showSuccess, showError } = useToast()

    try {
      await queueApi.reject({ mbids })
      // Remove rejected items from the list
      items.value = items.value.filter((item) => !mbids.includes(item.mbid))
      total.value = Math.max(0, total.value - mbids.length)
      showSuccess('Items rejected')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to reject items'
      showError('Failed to reject items')
      throw e
    } finally {
      loading.value = false
    }
  }

  function setFilters(newFilters: Partial<QueueFilters>) {
    filters.value = { ...filters.value, ...newFilters, offset: 0 }
  }

  function loadMore() {
    filters.value.offset += filters.value.limit
    return fetchPending(true)
  }

  function reset() {
    items.value = []
    total.value = 0
    filters.value.offset = 0
  }

  return {
    items,
    total,
    loading,
    error,
    filters,
    hasMore,
    fetchPending,
    approve,
    approveAll,
    reject,
    setFilters,
    loadMore,
    reset,
  }
})
