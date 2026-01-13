<script setup lang="ts">
import { computed } from 'vue';
import type { QueueItem } from '@/types/queue';
import Button from 'primevue/button';

interface Props {
  item: QueueItem;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  approve: [mbid: string];
  reject:  [mbid: string];
  preview: [item: QueueItem];
}>();

// Get display title (album or track title)
const displayTitle = computed(() => props.item.album || props.item.title || 'Unknown');

// Get match score color class
const scoreColorClass = computed(() => {
  const score = props.item.score ?? 0;

  if (score >= 90) return 'queue-card__score--high';
  if (score >= 70) return 'queue-card__score--medium';

  return 'queue-card__score--low';
});

// Get source tag info
const sourceTag = computed(() => {
  const tags = {
    listenbrainz: {
      label: 'ListenBrainz',
      icon:  'pi-chart-line',
      class: 'queue-card__tag--listenbrainz',
    },
    catalog: {
      label: 'Catalog',
      icon:  'pi-database',
      class: 'queue-card__tag--catalog',
    },
  };

  return tags[props.item.source];
});

// Get similar artist tag if available
const similarTag = computed(() => {
  if (props.item.similar_to && props.item.similar_to.length > 0) {
    return `Similar to ${ props.item.similar_to[0] }`;
  }

  return null;
});

// Default cover placeholder
const getDefaultCover = () => {
  return 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
      <rect width="200" height="200" fill="#1c1c27"/>
      <circle cx="100" cy="100" r="50" stroke="#3b3b54" stroke-width="4" fill="none"/>
      <circle cx="100" cy="100" r="20" fill="#3b3b54"/>
    </svg>
  `);
};

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
    <!-- Album Cover -->
    <div class="queue-card__cover">
      <img
        :src="item.cover_url || getDefaultCover()"
        :alt="`${displayTitle} cover`"
        class="queue-card__image"
        @error="($event.target as HTMLImageElement).src = getDefaultCover()"
      />

      <!-- Hover Overlay -->
      <div class="queue-card__overlay">
        <button
          class="queue-card__play-btn"
          @click="handlePreview"
          aria-label="Preview"
        >
          <i class="pi pi-play" style="margin-left: 2px;"></i>
        </button>
      </div>

      <!-- Score Badge -->
      <div v-if="item.score" class="queue-card__score" :class="scoreColorClass">
        {{ item.score }}% Match
      </div>
    </div>

    <!-- Content -->
    <div class="queue-card__content">
      <!-- Title & Artist -->
      <div class="queue-card__info">
        <h3 class="queue-card__title">{{ displayTitle }}</h3>
        <p class="queue-card__artist">
          {{ item.artist }}
          <span v-if="item.year"> &bull; {{ item.year }}</span>
        </p>
      </div>

      <!-- Tags -->
      <div class="queue-card__tags">
        <span class="queue-card__tag" :class="sourceTag.class">
          <i :class="['pi', sourceTag.icon]"></i>
          {{ sourceTag.label }}
        </span>
        <span v-if="similarTag" class="queue-card__tag queue-card__tag--similar">
          <i class="pi pi-link"></i>
          {{ similarTag }}
        </span>
      </div>

      <!-- Actions -->
      <div class="queue-card__actions">
        <Button
          label="Approve"
          icon="pi pi-download"
          class="queue-card__approve-btn"
          @click="handleApprove"
        />
        <Button
          icon="pi pi-times"
          class="queue-card__reject-btn"
          severity="secondary"
          outlined
          aria-label="Reject"
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
  border: 1px solid var(--surface-600, #282839);
  background-color: var(--surface-700, #1c1c27);
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
  background-color: #000;
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
  background: rgba(0, 0, 0, 0.4);
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
  background: white;
  color: black;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.queue-card__play-btn:hover {
  transform: scale(1.1);
}

.queue-card__play-btn i {
  font-size: 1.5rem;
}

/* Score Badge */
.queue-card__score {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.queue-card__score--high {
  color: var(--green-400);
}

.queue-card__score--medium {
  color: var(--yellow-400);
}

.queue-card__score--low {
  color: var(--orange-400);
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
  color: white;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
}

.queue-card__artist {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--surface-300, #9d9db9);
  margin: 0;
}

/* Tags */
.queue-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.queue-card__tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--surface-300, #9d9db9);
}

.queue-card__tag i {
  font-size: 0.75rem;
}

.queue-card__tag--listenbrainz {
  background: rgba(43, 43, 238, 0.2);
  border-color: rgba(43, 43, 238, 0.2);
  color: var(--primary-400);
}

.queue-card__tag--catalog {
  background: rgba(168, 85, 247, 0.2);
  border-color: rgba(168, 85, 247, 0.2);
  color: var(--purple-400);
}

.queue-card__tag--similar {
  background: rgba(45, 212, 191, 0.2);
  border-color: rgba(45, 212, 191, 0.2);
  color: var(--teal-400);
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
  background: var(--primary-500);
  border-color: var(--primary-500);
}

:deep(.queue-card__approve-btn:hover) {
  background: var(--primary-600);
  border-color: var(--primary-600);
}

:deep(.queue-card__reject-btn) {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border-color: var(--surface-600);
  color: var(--surface-300);
}

:deep(.queue-card__reject-btn:hover) {
  border-color: var(--red-400);
  color: var(--red-400);
  background: rgba(248, 113, 113, 0.1);
}
</style>
