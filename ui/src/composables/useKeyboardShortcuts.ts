import type { KeyboardShortcutsConfig, ShortcutDefinition } from '@/types';

import { ref, onMounted, onUnmounted } from 'vue';

export const QUEUE_SHORTCUTS: ShortcutDefinition[] = [
  { key: '↑ ↓ ← →', description: 'Navigate between items' },
  { key: 'Space', description: 'Play/pause preview' },
  { key: 'a', description: 'Approve focused item' },
  { key: 'r', description: 'Reject focused item' },
  { key: 'i', description: 'Open MusicBrainz for focused item' },
  { key: '?', description: 'Show keyboard shortcuts' },
  { key: 'Esc', description: 'Close help / clear focus' },
];

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig = {}) {
  const isHelpOpen = ref(false);

  function isInputFocused(): boolean {
    const activeElement = document.activeElement;

    if (!activeElement) {
      return false;
    }

    const tagName = activeElement.tagName.toLowerCase();
    const isEditable = activeElement.getAttribute('contenteditable') === 'true';
    const isInput = ['input', 'textarea', 'select'].includes(tagName);

    return isInput || isEditable;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (isInputFocused()) {
      return;
    }

    // Ignore if modifier keys are pressed (except Shift for ?)
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    switch (event.key) {
      case 'a':
        event.preventDefault();
        config.onApprove?.();
        break;

      case 'r':
        event.preventDefault();
        config.onReject?.();
        break;

      case 'i':
        event.preventDefault();
        config.onResearch?.();
        break;

      case '?':
        event.preventDefault();
        isHelpOpen.value = true;
        break;

      case 'Escape':
        event.preventDefault();

        if (isHelpOpen.value) {
          isHelpOpen.value = false;
        } else {
          config.onClearFocus?.();
        }

        break;

      case 'ArrowUp':
        event.preventDefault();
        config.onNavigate?.('up');
        break;

      case 'ArrowDown':
        event.preventDefault();
        config.onNavigate?.('down');
        break;

      case 'ArrowLeft':
        event.preventDefault();
        config.onNavigate?.('left');
        break;

      case 'ArrowRight':
        event.preventDefault();
        config.onNavigate?.('right');
        break;

      case ' ':
        event.preventDefault();
        config.onTogglePreview?.();
        break;
    }
  }

  function openHelp() {
    isHelpOpen.value = true;
  }

  function closeHelp() {
    isHelpOpen.value = false;
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
  });

  return {
    isHelpOpen,
    openHelp,
    closeHelp,
    shortcuts: QUEUE_SHORTCUTS,
  };
}
