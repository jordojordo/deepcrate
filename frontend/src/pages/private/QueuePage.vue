<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useQueue } from '@/composables/useQueue'

import Message from 'primevue/message'
import Button from 'primevue/button'
import QueueFilters from '@/components/queue/QueueFilters.vue'
import QueueList from '@/components/queue/QueueList.vue'

const {
  items,
  total,
  loading,
  error,
  filters,
  hasMore,
  fetchPending,
  approveItems,
  rejectItems,
  updateFilters,
  loadMore: loadMoreItems,
  reset,
} = useQueue()

onMounted(() => {
  fetchPending()
})

watch(
  () => [filters.value.source, filters.value.sort, filters.value.order],
  () => {
    reset()
    fetchPending()
  }
)

async function handleApprove(mbids: string[]) {
  try {
    await approveItems(mbids)
  } catch {
    // Error is already handled in the store
  }
}

async function handleReject(mbids: string[]) {
  try {
    await rejectItems(mbids)
  } catch {
    // Error is already handled in the store
  }
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-color">Queue</h1>
      <p class="mt-1 text-muted">Review and manage pending music recommendations</p>
    </div>

    <!-- Error Message -->
    <Message v-if="error" severity="error" class="mb-6" :closable="false">
      {{ error }}
    </Message>

    <!-- Filters -->
    <div class="mb-6">
      <QueueFilters :model-value="filters" @update:model-value="updateFilters($event)" />
    </div>

    <!-- Total Count -->
    <div class="mb-4 text-sm text-muted">
      {{ total }} pending item{{ total === 1 ? '' : 's' }}
    </div>

    <!-- Queue List -->
    <QueueList :items="items" :loading="loading" @approve="handleApprove" @reject="handleReject" />

    <!-- Load More Button -->
    <div v-if="hasMore && !loading" class="mt-6 text-center">
      <Button label="Load More" outlined @click="loadMoreItems" />
    </div>
  </div>
</template>
