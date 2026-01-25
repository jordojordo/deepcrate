<script setup lang="ts">
import { computed } from 'vue';
import { usePlayer } from '@/composables/usePlayer';

import Button from 'primevue/button';
import Slider from 'primevue/slider';
import Tag from 'primevue/tag';

const {
  currentTrack,
  isPlaying,
  isLoading,
  currentTime,
  duration,
  volume,
  isMuted,
  error,
  source,
  hasTrack,
  progress,
  togglePlay,
  seek,
  setVolume,
  toggleMute,
  close,
} = usePlayer();

const displayTime = computed(() => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${ mins }:${ secs.toString().padStart(2, '0') }`;
  };

  return `${ formatTime(currentTime.value) } / ${ formatTime(duration.value) }`;
});

const progressPercent = computed(() => progress.value * 100);

const volumePercent = computed({
  get: () => volume.value * 100,
  set: (val: number) => setVolume(val / 100),
});

const volumeIcon = computed(() => {
  if (isMuted.value || volume.value === 0) {
    return 'pi pi-volume-off';
  }
  if (volume.value < 0.5) {
    return 'pi pi-volume-down';
  }

  return 'pi pi-volume-up';
});

const sourceLabel = computed(() => {
  if (!source.value) return null;

  return source.value.charAt(0).toUpperCase() + source.value.slice(1);
});

function handleProgressClick(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const position = (event.clientX - rect.left) / rect.width;

  seek(Math.max(0, Math.min(1, position)));
}

const getDefaultCover = () => {
  return 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
      <rect width="200" height="200" fill="#1c1c27"/>
      <circle cx="100" cy="100" r="50" stroke="#3b3b54" stroke-width="4" fill="none"/>
      <circle cx="100" cy="100" r="20" fill="#3b3b54"/>
    </svg>
  `);
};

const playButtonPt = {
  root: {
    style: {
      color:           'var(--r-overlay-text-secondary)',
      backgroundColor: 'transparent',
      border:          'none',
    },
  },
  icon: { style: { color: 'inherit' } },
};

// Passthrough styles for overlay components
const overlayButtonPt = {
  root: {
    style: {
      color:           'var(--r-overlay-text-secondary)',
      backgroundColor: 'transparent',
      border:          'none',
    },
  },
  icon: { style: { color: 'inherit' } },
};

const volumeSliderPt = {
  root:   { style: { width: '80px' } },
  track:  { style: { background: 'var(--r-overlay-track)' } },
  range:  { style: { background: 'var(--r-overlay-track-fill)' } },
  handle: {
    style: {
      background:  'var(--r-overlay-text-primary)',
      borderColor: 'var(--r-overlay-text-primary)',
    },
  },
};
</script>

<template>
  <Transition name="slide-up">
    <div v-if="hasTrack" class="preview-player">
      <div class="preview-player__content">
        <div class="preview-player__cover">
          <img
            :src="currentTrack?.coverUrl || getDefaultCover()"
            :alt="currentTrack?.title || 'Album cover'"
            class="preview-player__image"
            @error="($event.target as HTMLImageElement).src = getDefaultCover()"
          />
          <div v-if="isLoading" class="preview-player__loading">
            <i class="pi pi-spin pi-spinner"></i>
          </div>
        </div>

        <div class="preview-player__info">
          <p class="preview-player__title">{{ currentTrack?.title }}</p>
          <p class="preview-player__artist">{{ currentTrack?.artist }}</p>
        </div>

        <div class="preview-player__controls">
          <Button
            :icon="isPlaying ? 'pi pi-pause' : 'pi pi-play'"
            class="preview-player__play-btn"
            rounded
            :disabled="isLoading || !!error"
            @click="togglePlay"
            aria-label="Toggle play"
            :pt="playButtonPt"
          />
        </div>

        <div class="preview-player__progress-container">
          <div
            class="preview-player__progress"
            @click="handleProgressClick"
            role="slider"
            :aria-valuenow="currentTime"
            :aria-valuemin="0"
            :aria-valuemax="duration"
            tabindex="0"
          >
            <div
              class="preview-player__progress-fill"
              :style="{ width: `${progressPercent}%` }"
            ></div>
          </div>
          <span class="preview-player__time">{{ displayTime }}</span>
        </div>

        <div class="preview-player__volume">
          <Button
            :icon="volumeIcon"
            class="preview-player__volume-btn"
            text
            rounded
            @click="toggleMute"
            aria-label="Toggle mute"
            :pt="overlayButtonPt"
          />
          <Slider
            v-model="volumePercent"
            class="preview-player__volume-slider"
            :pt="volumeSliderPt"
          />
        </div>

        <div v-if="sourceLabel" class="preview-player__source">
          <Tag
            :value="sourceLabel"
            severity="info"
            size="small"
          />
        </div>

        <Button
          icon="pi pi-times"
          class="preview-player__close-btn"
          text
          rounded
          @click="close"
          aria-label="Close player"
          :pt="overlayButtonPt"
        />
      </div>

      <div v-if="error" class="preview-player__error">
        <i class="pi pi-exclamation-circle"></i>
        <span>{{ error }}</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.preview-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 72px;
  background: var(--r-overlay-dark);
  border-top: 1px solid var(--r-border-default);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.preview-player__content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

/* Album Art */
.preview-player__cover {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 0.375rem;
  overflow: hidden;
  background: var(--surface-900);
}

.preview-player__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-player__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--r-overlay-medium);
  color: var(--primary-400);
}

.preview-player__loading i {
  font-size: 1.25rem;
}

/* Track Info */
.preview-player__info {
  min-width: 120px;
  max-width: 200px;
  overflow: hidden;
}

.preview-player__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--r-overlay-text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-player__artist {
  font-size: 0.75rem;
  color: var(--r-overlay-text-secondary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Controls */
.preview-player__controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.preview-player__play-btn:hover {
  color: var(--r-overlay-text-primary) !important;
  border-color: var(--border-glow) !important;
}

.preview-player__play-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Progress Bar */
.preview-player__progress-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 150px;
  max-width: 600px;
}

.preview-player__progress {
  flex: 1;
  height: 4px;
  background: var(--r-overlay-track);
  border-radius: 2px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.preview-player__progress:hover {
  height: 6px;
}

.preview-player__progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--r-overlay-track-fill);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.preview-player__time {
  font-size: 0.75rem;
  color: var(--r-overlay-text-secondary);
  font-variant-numeric: tabular-nums;
  min-width: 70px;
}

/* Volume */
.preview-player__volume {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.preview-player__volume-btn {
  width: 2rem;
  height: 2rem;
}

.preview-player__volume-btn:hover {
  color: var(--r-overlay-text-primary) !important;
}

/* Source Badge */
.preview-player__source {
  display: none;
}

@media (min-width: 768px) {
  .preview-player__source {
    display: flex;
  }
}

/* Close Button */
.preview-player__close-btn {
  width: 2rem;
  height: 2rem;
}

.preview-player__close-btn:hover {
  color: var(--r-overlay-text-primary) !important;
}

/* Error State */
.preview-player__error {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%) translateY(-100%);
  background: var(--red-500);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem 0.375rem 0 0;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Slide-up Animation */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* Responsive */
@media (max-width: 640px) {
  .preview-player__content {
    gap: 0.75rem;
    padding: 0 1rem;
  }

  .preview-player__info {
    min-width: 80px;
    max-width: 120px;
  }

  .preview-player__progress-container {
    min-width: 100px;
  }

  .preview-player__time {
    display: none;
  }

  .preview-player__volume {
    display: none;
  }
}
</style>
