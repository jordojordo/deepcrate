import { ref, onMounted, onUnmounted } from 'vue';

export function useBreakpoint(breakpoint = 768) {
  const isMobile = ref(false);
  let mediaQuery: MediaQueryList | null = null;

  function update(e: MediaQueryListEvent | MediaQueryList) {
    isMobile.value = !e.matches;
  }

  onMounted(() => {
    mediaQuery = window.matchMedia(`(min-width: ${ breakpoint }px)`);
    isMobile.value = !mediaQuery.matches;
    mediaQuery.addEventListener('change', update);
  });

  onUnmounted(() => {
    mediaQuery?.removeEventListener('change', update);
  });

  return { isMobile };
}
