import type { QueueItem, PreviewTrack } from '@/types';

import { computed } from 'vue';
import { usePlayerStore } from '@/stores/player';
import { queueItemToPreviewTrack } from '@/types';

export function usePlayer() {
  const store = usePlayerStore();

  const currentTrack = computed(() => store.currentTrack);
  const isPlaying = computed(() => store.isPlaying);
  const isLoading = computed(() => store.isLoading);
  const currentTime = computed(() => store.currentTime);
  const duration = computed(() => store.duration);
  const volume = computed(() => store.volume);
  const isMuted = computed(() => store.isMuted);
  const error = computed(() => store.error);
  const source = computed(() => store.source);
  const hasTrack = computed(() => store.hasTrack);
  const progress = computed(() => store.progress);

  /**
   * Play a track from a PreviewTrack object
   */
  async function playTrack(track: PreviewTrack): Promise<void> {
    return store.playTrack(track);
  }

  /**
   * Play a track from a QueueItem
   */
  async function playQueueItem(item: QueueItem): Promise<void> {
    const track = queueItemToPreviewTrack(item);

    return store.playTrack(track);
  }

  function play(): void {
    store.play();
  }

  function pause(): void {
    store.pause();
  }

  function togglePlay(): void {
    store.togglePlay();
  }

  function seek(position: number): void {
    store.seek(position);
  }

  function setVolume(newVolume: number): void {
    store.setVolume(newVolume);
  }

  function toggleMute(): void {
    store.toggleMute();
  }

  function close(): void {
    store.close();
  }

  return {
    // State
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

    // Actions
    playTrack,
    playQueueItem,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    close,
  };
}
