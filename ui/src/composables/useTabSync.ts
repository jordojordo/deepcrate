import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

interface UseTabSyncOptions<T extends string> {
  validTabs:   readonly T[];
  defaultTab:  T;
  queryParam?: string;
}

export function useTabSync<T extends string>(options: UseTabSyncOptions<T>) {
  const { validTabs, defaultTab, queryParam = 'tab' } = options;

  const route = useRoute();
  const router = useRouter();

  function isValidTab(value: unknown): value is T {
    return typeof value === 'string' && validTabs.includes(value as T);
  }

  function getTabFromQuery(): T {
    const queryValue = route.query[queryParam];

    return isValidTab(queryValue) ? queryValue : defaultTab;
  }

  const activeTab = computed({
    get: () => getTabFromQuery(),
    set: (value: T) => {
      if (!isValidTab(value)) {
        return;
      }

      const query = { ...route.query };

      if (value === defaultTab) {
        delete query[queryParam];
      } else {
        query[queryParam] = value;
      }

      router.replace({ query });
    },
  });

  return { activeTab };
}
