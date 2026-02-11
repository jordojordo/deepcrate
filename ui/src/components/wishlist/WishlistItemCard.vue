<script setup lang="ts">
import type { WishlistEntryWithStatus, WishlistDownloadStatus } from '@/types';

import { computed, ref, watch } from 'vue';

import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Tag from 'primevue/tag';
import { getDefaultCoverUrl } from '@/utils/formatters';

interface Props {
  item:       WishlistEntryWithStatus;
  processing: boolean;
  selected:   boolean;
  focused?:   boolean;
}

const props = withDefaults(defineProps<Props>(), { focused: false });

const emit = defineEmits<{
  select:  [id: string];
  edit:    [item: WishlistEntryWithStatus];
  delete:  [id: string];
  requeue: [id: string];
}>();

const cardRef = ref<HTMLElement | null>(null);

// Scroll focused card into view
watch(
  () => props.focused,
  (isFocused) => {
    if (isFocused && cardRef.value) {
      cardRef.value.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
);

const sourceTag = computed((): { label: string; icon: string; severity: 'info' | 'secondary' | 'warn' } => {
  const tags: Record<string, { label: string; icon: string; severity: 'info' | 'secondary' | 'warn' }> = {
    listenbrainz: {
      label: 'ListenBrainz', icon: 'pi-chart-line', severity: 'info'
    },
    catalog:      {
      label: 'Catalog', icon: 'pi-database', severity: 'secondary'
    },
    manual:       {
      label: 'Manual', icon: 'pi-plus', severity: 'warn'
    },
  };

  return tags[props.item.source || 'manual'] ?? tags.manual!;
});

const downloadStatusDisplay = computed(() => {
  const statusMap: Record<WishlistDownloadStatus, { label: string; icon: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' }> = {
    none:              {
      label: 'Pending', icon: 'pi-clock', severity: 'secondary'
    },
    pending:           {
      label: 'Queued', icon: 'pi-hourglass', severity: 'info'
    },
    searching:         {
      label: 'Searching', icon: 'pi-spin pi-spinner', severity: 'info'
    },
    pending_selection: {
      label: 'Select', icon: 'pi-question-circle', severity: 'warn'
    },
    deferred:          {
      label: 'Deferred', icon: 'pi-pause', severity: 'secondary'
    },
    queued:            {
      label: 'Downloading', icon: 'pi-spin pi-spinner', severity: 'info'
    },
    downloading:       {
      label: 'Downloading', icon: 'pi-spin pi-spinner', severity: 'info'
    },
    completed:         {
      label: 'Downloaded', icon: 'pi-check-circle', severity: 'success'
    },
    failed:            {
      label: 'Failed', icon: 'pi-times-circle', severity: 'danger'
    },
  };

  return statusMap[props.item.downloadStatus] || statusMap.none;
});

const isDownloading = computed(() =>
  ['searching', 'queued', 'downloading'].includes(props.item.downloadStatus)
);

const canRequeue = computed(() =>
  ['none', 'failed', 'completed'].includes(props.item.downloadStatus)
);

function handleSelect() {
  emit('select', props.item.id);
}

function handleEdit() {
  emit('edit', props.item);
}

function handleDelete() {
  emit('delete', props.item.id);
}

function handleRequeue() {
  emit('requeue', props.item.id);
}

function handleCardClick(event: MouseEvent) {
  const target = event.target as HTMLElement;

  // Don't trigger selection if clicking on a button, checkbox, or actions area
  if (target.closest('button') || target.closest('.p-checkbox') || target.closest('.wishlist-card__actions')) {
    return;
  }

  emit('select', props.item.id);
}
</script>

<template>
  <div
    ref="cardRef"
    class="wishlist-card group"
    :class="{
      'wishlist-card--focused': focused,
      'wishlist-card--selected': selected,
    }"
    @click="handleCardClick"
  >
    <div class="wishlist-card__cover">
      <img
        :src="item.coverUrl || getDefaultCoverUrl()"
        :alt="`${item.title} cover`"
        class="wishlist-card__image"
        @error="($event.target as HTMLImageElement).src = getDefaultCoverUrl()"
      />

      <div class="wishlist-card__overlay">
        <div class="wishlist-card__select">
          <Checkbox
            :model-value="selected"
            binary
            @update:model-value="handleSelect"
          />
        </div>
      </div>

      <!-- Download status badge -->
      <div class="wishlist-card__status">
        <Tag
          :value="downloadStatusDisplay.label"
          :icon="'pi ' + downloadStatusDisplay.icon"
          :severity="downloadStatusDisplay.severity"
          class="wishlist-card__status-tag"
        />
      </div>
    </div>

    <div class="wishlist-card__content">
      <div class="wishlist-card__info">
        <h3 class="wishlist-card__title">{{ item.title || 'Unknown' }}</h3>
        <p class="wishlist-card__artist">
          {{ item.artist }}
          <span v-if="item.year"> &bull; {{ item.year }}</span>
        </p>
      </div>

      <div class="wishlist-card__tags">
        <Tag
          :value="sourceTag.label"
          :icon="'pi ' + sourceTag.icon"
          :severity="sourceTag.severity"
        />
        <Tag
          v-if="item.type !== 'album'"
          :value="item.type"
          severity="secondary"
        />
      </div>

      <!-- Error message for failed downloads -->
      <div v-if="item.downloadStatus === 'failed' && item.downloadError" class="wishlist-card__error">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{{ item.downloadError }}</span>
      </div>

      <div class="wishlist-card__actions">
        <Button
          v-if="canRequeue && !isDownloading"
          icon="pi pi-refresh"
          text
          size="small"
          class="wishlist-card__action-btn"
          title="Re-queue for download"
          :loading="processing"
          :disabled="processing"
          @click="handleRequeue"
        />
        <Button
          icon="pi pi-pencil"
          text
          size="small"
          class="wishlist-card__action-btn"
          title="Edit"
          :disabled="processing"
          @click="handleEdit"
        />
        <Button
          icon="pi pi-trash"
          text
          size="small"
          severity="danger"
          class="wishlist-card__action-btn"
          title="Delete"
          :loading="processing"
          :disabled="processing"
          @click="handleDelete"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.wishlist-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 0.75rem;
  border: 1px solid var(--r-border-default);
  background-color: var(--p-card-background);
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    border-color: rgba(43, 43, 238, 0.5);
    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5),
                0 0 15px rgba(43, 43, 238, 0.1);

    .wishlist-card__image {
      transform: scale(1.05);
      opacity: 1;
    }

    .wishlist-card__overlay {
      opacity: 1;
    }
  }

  &--focused {
    border-color: var(--primary-500);
    box-shadow: 0 0 0 2px var(--primary-500);
  }

  &--selected {
    border-color: var(--primary-400);
    background-color: rgba(43, 43, 238, 0.05);

    .wishlist-card__overlay {
      opacity: 1;
    }
  }

  /* Cover Section */
  &__cover {
    position: relative;
    aspect-ratio: 1 / 1;
    width: 100%;
    overflow: hidden;
    background-color: var(--surface-900);
  }

  &__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.9;
    transition: transform 0.5s ease, opacity 0.3s ease;
  }

  /* Hover Overlay */
  &__overlay {
    position: absolute;
    inset: 0;
    background: var(--r-overlay-light);
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 0.5rem;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &__select {
    background: var(--surface-card);
    border-radius: 0.375rem;
    padding: 0.25rem;
  }

  /* Status Badge */
  &__status {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
  }

  /* Content Section */
  &__content {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    gap: 0.75rem;
    flex: 1;
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  &__title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--r-text-primary);
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 0;
  }

  &__artist {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--r-text-secondary);
    margin: 0;
  }

  /* Tags */
  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  /* Error message */
  &__error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.375rem;
    background: rgba(239, 68, 68, 0.1);
    color: var(--red-400);
    font-size: 0.75rem;

    i {
      flex-shrink: 0;
    }

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  /* Actions */
  &__actions {
    display: flex;
    gap: 0.25rem;
    margin-top: auto;
    padding-top: 0.5rem;
    justify-content: flex-end;
  }
}

:deep(.wishlist-card__status-tag) {
  font-size: 0.625rem;
  padding: 0.25rem 0.5rem;
}

:deep(.wishlist-card__action-btn) {
  width: 2rem;
  height: 2rem;
  padding: 0;
  color: var(--r-text-muted);
}

:deep(.wishlist-card__action-btn:hover) {
  background: var(--r-hover-bg);
  color: var(--r-text-primary);
}
</style>
