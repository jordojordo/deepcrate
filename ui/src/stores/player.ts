import type { PreviewTrack, PlayerState } from '@/types';

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

import * as previewApi from '@/services/preview';
import { useToast } from '@/composables/useToast';

export const usePlayerStore = defineStore('player', () => {
  const { showError, showWarning } = useToast();

  const currentTrack = ref<PreviewTrack | null>(null);
  const isPlaying = ref(false);
  const isLoading = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const volume = ref(0.7);
  const isMuted = ref(false);
  const error = ref<string | null>(null);
  const source = ref<'deezer' | 'spotify' | null>(null);

  let audio: HTMLAudioElement | null = null;
  let isClosing = false;

  const hasTrack = computed(() => currentTrack.value !== null);
  const progress = computed(() => (duration.value > 0 ? currentTime.value / duration.value : 0));

  function getAudio(): HTMLAudioElement {
    if (!audio) {
      audio = new Audio();
      audio.volume = volume.value;

      audio.addEventListener('timeupdate', () => {
        currentTime.value = audio!.currentTime;
      });

      audio.addEventListener('loadedmetadata', () => {
        duration.value = audio!.duration;
      });

      audio.addEventListener('ended', () => {
        isPlaying.value = false;
        currentTime.value = 0;
      });

      audio.addEventListener('error', () => {
        // Ignore errors when closing/clearing or when no track is loaded
        if (isClosing || !currentTrack.value) {
          return;
        }

        error.value = 'Failed to load audio';
        isPlaying.value = false;
        isLoading.value = false;
        showError('Audio Error', 'Failed to load preview audio');
      });

      audio.addEventListener('canplay', () => {
        isLoading.value = false;
      });
    }

    return audio;
  }

  async function loadTrack(track: PreviewTrack): Promise<boolean> {
    // Stop any currently playing audio first and keep isClosing true until we have a valid URL
    isClosing = true;

    if (audio) {
      audio.pause();
      audio.src = '';
    }

    error.value = null;
    isLoading.value = true;
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
    currentTrack.value = track;
    source.value = null;

    try {
      if (track.type === 'album' && track.album) {
        const albumResponse = await previewApi.getAlbumPreview({
          artist:      track.artist,
          album:       track.album,
          mbid:        track.mbid,
          sourceTrack: track.sourceTrack,
        });

        if (!albumResponse.available || !albumResponse.url) {
          currentTrack.value = null;
          isLoading.value = false;
          showWarning('Preview Unavailable', `No preview found for "${ track.album }" by ${ track.artist }`);

          return false;
        }

        if (albumResponse.selectedTrack) {
          currentTrack.value = {
            ...track,
            title: albumResponse.selectedTrack,
          };
        }

        const audioEl = getAudio();

        // Now we have a valid URL, allow error events to be shown
        isClosing = false;
        audioEl.src = albumResponse.url;
        source.value = albumResponse.source;

        return true;
      }

      const response = await previewApi.getPreview({
        artist: track.artist,
        track:  track.title,
      });

      if (!response.available || !response.url) {
        currentTrack.value = null;
        isLoading.value = false;
        showWarning('Preview Unavailable', `No preview found for "${ track.title }" by ${ track.artist }`);

        return false;
      }

      const audioEl = getAudio();

      // Now we have a valid URL, allow error events to be shown
      isClosing = false;
      audioEl.src = response.url;
      source.value = response.source;

      return true;
    } catch {
      // Only show error for actual failures (network errors, server errors, etc.)
      currentTrack.value = null;
      isLoading.value = false;
      showError('Preview Error', 'Failed to fetch preview URL');

      return false;
    }
  }

  function play(): void {
    if (!audio || !currentTrack.value) return;

    audio.play().catch(() => {
      error.value = 'Playback failed';
      showError('Playback Error', 'Failed to play audio');
    });
    isPlaying.value = true;
  }

  function pause(): void {
    if (!audio) return;

    audio.pause();
    isPlaying.value = false;
  }

  function togglePlay(): void {
    if (isPlaying.value) {
      pause();
    } else {
      play();
    }
  }

  function seek(position: number): void {
    if (!audio || duration.value === 0) return;

    audio.currentTime = position * duration.value;
    currentTime.value = audio.currentTime;
  }

  function setVolume(newVolume: number): void {
    volume.value = Math.max(0, Math.min(1, newVolume));

    if (audio) {
      audio.volume = isMuted.value ? 0 : volume.value;
    }
  }

  function toggleMute(): void {
    isMuted.value = !isMuted.value;

    if (audio) {
      audio.volume = isMuted.value ? 0 : volume.value;
    }
  }

  function close(): void {
    isClosing = true;

    if (audio) {
      audio.pause();
      audio.src = '';
    }

    currentTrack.value = null;
    isPlaying.value = false;
    isLoading.value = false;
    currentTime.value = 0;
    duration.value = 0;
    error.value = null;
    source.value = null;
  }

  async function playTrack(track: PreviewTrack): Promise<void> {
    const loaded = await loadTrack(track);

    if (loaded) {
      play();
    }
  }

  function getState(): PlayerState {
    return {
      currentTrack: currentTrack.value,
      isPlaying:    isPlaying.value,
      isLoading:    isLoading.value,
      currentTime:  currentTime.value,
      duration:     duration.value,
      volume:       volume.value,
      isMuted:      isMuted.value,
      error:        error.value,
      source:       source.value,
    };
  }

  return {
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

    loadTrack,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    close,
    playTrack,
    getState,
  };
});
