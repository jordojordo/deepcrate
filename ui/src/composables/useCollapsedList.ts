import type { MaybeRefOrGetter } from 'vue';

import { computed, toValue } from 'vue';

interface CollapsedListOptions {
  max?:    number;
  prefix?: string;
}

interface CollapsedListResult {
  displayTag: string | null;
  tooltip:    string | null;
}

export function getCollapsedList(
  items:   string[] | undefined,
  options: CollapsedListOptions = {},
): CollapsedListResult {
  const { max = 1, prefix } = options;
  const list = items ?? [];

  if (list.length === 0) {
    return { displayTag: null, tooltip: null };
  }

  const visible   = list.slice(0, max);
  const remaining = list.length - max;

  const label   = prefix ? `${ prefix } ${ visible.join(', ') }` : visible.join(', ');
  const display = remaining > 0 ? `${ label } (+${ remaining })` : label;
  const full    = prefix ? `${ prefix } ${ list.join(', ') }` : list.join(', ');
  const tooltip = remaining > 0 ? full : null;

  return { displayTag: display, tooltip };
}

export function useCollapsedList(
  items:   MaybeRefOrGetter<string[] | undefined>,
  options: CollapsedListOptions = {},
) {
  const displayTag = computed(() => getCollapsedList(toValue(items), options).displayTag);
  const tooltip    = computed(() => getCollapsedList(toValue(items), options).tooltip);

  return { displayTag, tooltip };
}
