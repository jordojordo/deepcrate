<script setup lang="ts">
import Card from 'primevue/card'
import Select from 'primevue/select'
import Button from 'primevue/button'
import type { QueueFilters } from '@/types'
import { SORT_OPTIONS } from '@/constants/queue'

const sortOptions = [...SORT_OPTIONS]

const props = defineProps<{
  modelValue: QueueFilters
}>()

const emit = defineEmits<{
  'update:modelValue': [value: QueueFilters]
}>()

const sourceOptions = [
  { label: 'All Sources', value: 'all' },
  { label: 'ListenBrainz', value: 'listenbrainz' },
  { label: 'Catalog', value: 'catalog' },
]

function updateFilter<K extends keyof QueueFilters>(key: K, value: QueueFilters[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function toggleOrder() {
  updateFilter('order', props.modelValue.order === 'asc' ? 'desc' : 'asc')
}
</script>

<template>
  <Card>
    <template #content>
      <div class="flex flex-wrap align-items-center gap-4">
        <!-- Source Filter -->
        <div class="flex flex-column gap-2">
          <label for="source-filter" class="text-sm font-medium">Source</label>
          <Select
            id="source-filter"
            :model-value="modelValue.source"
            @update:model-value="updateFilter('source', $event)"
            :options="sourceOptions"
            option-label="label"
            option-value="value"
            class="w-12rem"
          />
        </div>

        <!-- Sort Filter -->
        <div class="flex flex-column gap-2">
          <label for="sort-filter" class="text-sm font-medium">Sort by</label>
          <Select
            id="sort-filter"
            :model-value="modelValue.sort"
            @update:model-value="updateFilter('sort', $event)"
            :options="sortOptions"
            option-label="label"
            option-value="value"
            class="w-12rem"
          />
        </div>

        <!-- Order Toggle -->
        <div class="flex flex-column gap-2">
          <label class="text-sm font-medium">Order</label>
          <Button
            :icon="modelValue.order === 'desc' ? 'pi pi-sort-amount-down' : 'pi pi-sort-amount-up'"
            :label="modelValue.order === 'desc' ? 'Descending' : 'Ascending'"
            outlined
            @click="toggleOrder"
          />
        </div>
      </div>
    </template>
  </Card>
</template>
