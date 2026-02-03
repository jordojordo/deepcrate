<script setup lang="ts">
import type { WishlistEntryWithStatus } from '@/types/wishlist';

import { ref, watch } from 'vue';

import WishlistItemCard from './WishlistItemCard.vue';
import ProgressSpinner from 'primevue/progressspinner';
import EmptyState from '@/components/common/EmptyState.vue';

interface Props {
  items:        WishlistEntryWithStatus[];
  loading?:     boolean;
  isProcessing: (id: string) => boolean;
  isSelected:   (id: string) => boolean;
  focusIndex?:  number;
}

withDefaults(defineProps<Props>(), {
  loading:    false,
  focusIndex: -1,
});

const emit = defineEmits<{
  select:               [id: string];
  edit:                 [item: WishlistEntryWithStatus];
  delete:               [id: string];
  requeue:              [id: string];
  'update:focus-index': [index: number];
  'container-ref':      [el: HTMLElement | null];
}>();

const gridItemsRef = ref<HTMLElement | null>(null);

watch(gridItemsRef, (el) => {
  emit('container-ref', el);
}, { immediate: true });

function handleSelect(id: string) {
  emit('select', id);
}

function handleEdit(item: WishlistEntryWithStatus) {
  emit('edit', item);
}

function handleDelete(id: string) {
  emit('delete', id);
}

function handleRequeue(id: string) {
  emit('requeue', id);
}

function handleCardClick(index: number) {
  emit('update:focus-index', index);
}
</script>

<template>
  <div class="wishlist-grid">
    <div v-if="loading && items.length === 0" class="wishlist-grid__loading">
      <ProgressSpinner style="width: 48px; height: 48px" />
    </div>

    <EmptyState
      v-else-if="!loading && items.length === 0"
      icon="pi-heart"
      title="No wishlist items"
      message="Items you approve from the queue will appear here"
    />

    <div v-else ref="gridItemsRef" class="wishlist-grid__items">
      <WishlistItemCard
        v-for="(item, index) in items"
        :key="item.id"
        :item="item"
        :processing="isProcessing(item.id)"
        :selected="isSelected(item.id)"
        :focused="index === focusIndex"
        @select="handleSelect"
        @edit="handleEdit"
        @delete="handleDelete"
        @requeue="handleRequeue"
        @click="handleCardClick(index)"
      />
    </div>
  </div>
</template>

<style scoped>
.wishlist-grid {
  width: 100%;
  overflow-anchor: auto;
}

.wishlist-grid__loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.wishlist-grid__items {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 1.5rem;
}

@media (min-width: 520px) {
  .wishlist-grid__items {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .wishlist-grid__items {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .wishlist-grid__items {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
