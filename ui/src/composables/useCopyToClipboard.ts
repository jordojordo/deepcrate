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
  } catch {
    try {
      fallbackCopy(value);
      toast.showSuccess('Copied to clipboard');
      console.warn('Copied using the deprecated method (`document.execCommand()`). Use HTTPS for reliable clipboard access.');
    } catch(error) {
      toast.showError('Failed to copy to clipboard');
      throw error;
    }
  }
}

function fallbackCopy(text: string): void {
  const textarea = document.createElement('textarea');

  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
