import { ref, onMounted, onUnmounted } from 'vue';

export interface KeyboardShortcutsConfig {
  onApprove?: () => void;
  onReject?:  () => void;
}

export interface ShortcutDefinition {
  key:         string;
  description: string;
}

export const QUEUE_SHORTCUTS: ShortcutDefinition[] = [
  { key: 'a', description: 'Approve selected item' },
  { key: 'r', description: 'Reject selected item' },
  { key: '?', description: 'Show keyboard shortcuts' },
  { key: 'Esc', description: 'Clear selection' },
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
    // Ignore if typing in an input
    if (isInputFocused()) {
      return;
    }

    // Ignore if modifier keys are pressed (except Shift for ?)
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'a':
        event.preventDefault();
        config.onApprove?.();
        break;

      case 'r':
        event.preventDefault();
        config.onReject?.();
        break;

      case '?':
        event.preventDefault();
        isHelpOpen.value = true;
        break;

      case 'escape':
        event.preventDefault();

        if (isHelpOpen.value) {
          isHelpOpen.value = false;
        }

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
