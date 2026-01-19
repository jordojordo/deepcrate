import { useToast as usePrimeToast } from 'primevue/usetoast';

export function useToast() {
  const toast = usePrimeToast();

  function showSuccess(message: string, detail?: string) {
    toast.add({
      severity: 'success',
      summary:  message,
      detail,
      life:     3000,
    });
  }

  function showWarning(message: string, detail?: string) {
    toast.add({
      severity: 'warn',
      summary:  message,
      detail,
      life:     3000,
    });
  }

  function showError(message: string, detail?: string) {
    toast.add({
      severity: 'error',
      summary:  message,
      detail,
      life:     5000,
    });
  }

  function showInfo(message: string, detail?: string) {
    toast.add({
      severity: 'info',
      summary:  message,
      detail,
      life:     3000,
    });
  }

  return {
    showSuccess,
    showWarning,
    showError,
    showInfo,
  };
}
