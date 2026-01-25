<script setup lang="ts">
import type { QueueItem } from '@/types/queue';

import { computed } from 'vue';

import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { getDefaultCoverUrl } from '@/utils/formatters';

interface Props {
  item:        QueueItem;
  processing?: boolean;
}

const props = withDefaults(defineProps<Props>(), { processing: false });

const emit = defineEmits<{
  approve: [mbid: string];
  reject:  [mbid: string];
  preview: [item: QueueItem];
}>();

const displayTitle = computed(() => props.item.album || props.item.title || 'Unknown');

const sourceTag = computed(() => {
  const tags = {
    listenbrainz: {
      label:    'ListenBrainz',
      icon:     'pi-chart-line',
      severity: 'info',
    },
    catalog: {
      label:    'Catalog',
      icon:     'pi-database',
      severity: 'secondary',
    },
  };

  return tags[props.item.source];
});

const similarTag = computed(() => {
  const similarTo = props.item.similar_to;

  if (similarTo && similarTo.length > 0) {
    const first = similarTo[0];
    const remaining = similarTo.length - 1;

    if (remaining > 0) {
      return `Similar to ${ first } (+${ remaining })`;
    }

    return `Similar to ${ first }`;
  }

  return null;
});

const similarTooltip = computed(() => {
  const similarTo = props.item.similar_to;

  if (similarTo && similarTo.length > 0) {
    const first = similarTo[0];
    const remaining = similarTo.length - 1;

    if (remaining > 0) {
      return `Similar to ${ similarTo.join(', ') }`;
    }

    return `Similar to ${ first }`;
  }

  return null;
});

const isInLibrary = computed(() => props.item.in_library);

const handleApprove = () => {
  emit('approve', props.item.mbid);
};

const handleReject = () => {
  emit('reject', props.item.mbid);
};

const handlePreview = () => {
  emit('preview', props.item);
};
</script>

<template>
  <div class="queue-card group">
    <div class="queue-card__cover">
      <img
        :src="item.cover_url || getDefaultCoverUrl()"
        :alt="`${displayTitle} cover`"
        class="queue-card__image"
        @error="($event.target as HTMLImageElement).src = getDefaultCoverUrl()"
      />

      <div class="queue-card__overlay">
        <button
          class="queue-card__play-btn"
          @click="handlePreview"
          aria-label="Preview"
        >
          <i class="pi pi-play" style="margin-left: 2px;"></i>
        </button>
      </div>

      <div v-if="item.score" class="queue-card__score">
        {{ item.score }}% Match
      </div>
    </div>

    <div class="queue-card__content">
      <div class="queue-card__info">
        <h3 class="queue-card__title">{{ displayTitle }}</h3>
        <p class="queue-card__artist">
          {{ item.artist }}
          <span v-if="item.year"> &bull; {{ item.year }}</span>
        </p>
      </div>

      <div class="queue-card__tags">
        <Tag
          :value="sourceTag.label"
          :icon="'pi ' + sourceTag.icon"
          :severity="sourceTag.severity"
        />
        <Tag
          v-if="isInLibrary"
          value="In Library"
          icon="pi pi-check-circle"
          severity="success"
        />
        <Tag
          v-if="similarTag"
          :value="similarTag"
          v-tooltip.bottom="similarTooltip"
          icon="pi pi-link"
        />
      </div>

      <div class="queue-card__actions">
        <Button
          label="Approve"
          icon="pi pi-download"
          class="queue-card__approve-btn"
          :loading="processing"
          :disabled="processing"
          @click="handleApprove"
        />
        <Button
          icon="pi pi-times"
          class="queue-card__reject-btn"
          severity="secondary"
          outlined
          aria-label="Reject"
          :disabled="processing"
          @click="handleReject"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.queue-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 0.75rem;
  border: 1px solid var(--r-border-default);
  background-color: var(--p-card-background);
  overflow: hidden;
  transition: all 0.3s ease;
}

.queue-card:hover {
  border-color: rgba(43, 43, 238, 0.5);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5),
              0 0 15px rgba(43, 43, 238, 0.1);
}

/* Cover Section */
.queue-card__cover {
  position: relative;
  aspect-ratio: 1 / 1;
  width: 100%;
  overflow: hidden;
  background-color: var(--surface-900);
}

.queue-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.9;
  transition: transform 0.5s ease, opacity 0.3s ease;
}

.queue-card:hover .queue-card__image {
  transform: scale(1.1);
  opacity: 1;
}

/* Hover Overlay */
.queue-card__overlay {
  position: absolute;
  inset: 0;
  background: var(--r-overlay-medium);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.queue-card:hover .queue-card__overlay {
  opacity: 1;
}

.queue-card__play-btn {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--r-overlay-medium);
  color: var(--p-button-primary-color);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.queue-card__play-btn i {
  font-size: 1.5rem;
}

/* Score Badge */
.queue-card__score {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  padding: 0.25rem 0.25rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--r-overlay-medium);
  color: var(--p-button-primary-color);
  backdrop-filter: blur(8px);
  border: 1px solid var(--r-border-default);
}

/* Content Section */
.queue-card__content {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  gap: 0.75rem;
  flex: 1;
}

.queue-card__info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.queue-card__title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--r-text-primary);
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
}

.queue-card__artist {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--r-text-secondary);
  margin: 0;
}

/* Tags */
.queue-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

/* Actions */
.queue-card__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.75rem;
}

:deep(.queue-card__approve-btn) {
  flex: 1;
  height: 2.25rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--r-text-muted);
  background: var(--primary-500);
  border-color: var(--r-border-default);
}

:deep(.queue-card__approve-btn:hover) {
  border-color: var(--r-overlay-heavy);
  background: var(--r-overlay-light);
  color: var(--r-text-muted);
}

:deep(.queue-card__reject-btn) {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  color: var(--r-text-muted);
  background: var(--primary-500);
  border-color: var(--r-border-default);
}

:deep(.queue-card__reject-btn:hover) {
  border-color: var(--r-overlay-heavy);
  background: var(--r-overlay-light);
  color: var(--r-text-muted);
}
</style>
