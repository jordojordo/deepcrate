import type { useToast } from '@/composables/useToast';

export const COPY_CURSOR_CLASS = 'cursor-copy';

export async function copyToClipboard(
  text:  string | string[],
  toast: ReturnType<typeof useToast>,
): Promise<void> {
  const value = Array.isArray(text) ? text.join(' ') : text;

  try {
    await navigator.clipboard.writeText(value);
    toast.showSuccess('Copied to clipboard');
  } catch(error) {
    toast.showError('Failed to copy to clipboard');
    throw error;
  }
}
