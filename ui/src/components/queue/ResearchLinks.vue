<script setup lang="ts">
import type { Component } from 'vue';

import { computed, ref } from 'vue';
import { buildResearchLinks } from '@/utils/researchLinks';

import Button from 'primevue/button';
import Menu from 'primevue/menu';

import BandcampIcon from '@/components/icons/BandcampIcon.vue';
import DiscogsIcon from '@/components/icons/DiscogsIcon.vue';
import LastfmIcon from '@/components/icons/LastfmIcon.vue';
import MusicBrainzIcon from '@/components/icons/MusicBrainzIcon.vue';
import RymIcon from '@/components/icons/RymIcon.vue';

interface Props {
  artist: string;
  album?: string;
  track?: string;
  mbid:   string;
  mode?:  'inline' | 'dropdown';
}

interface ResearchLink {
  name:      string;
  url:       string;
  icon:      Component;
  iconSize?: string;
}

const iconMap: Record<string, { icon: Component; iconSize?: string }> = {
  MusicBrainz: { icon: MusicBrainzIcon },
  'Last.fm':   { icon: LastfmIcon },
  Discogs:     { icon: DiscogsIcon },
  RYM:         { icon: RymIcon },
  Bandcamp:    { icon: BandcampIcon, iconSize: '48' },
};

const props = withDefaults(defineProps<Props>(), { mode: 'inline' });

const links = computed<ResearchLink[]>(() => {
  const defs = buildResearchLinks({
    artist: props.artist,
    album:  props.album,
    track:  props.track,
    mbid:   props.mbid,
  });

  return defs.map(def => ({
    ...def,
    ...iconMap[def.name],
  })) as ResearchLink[];
});

const menuRef = ref<InstanceType<typeof Menu> | null>(null);

const menuItems = computed(() => [{
  items: links.value.map(link => ({
    label:         link.name,
    url:           link.url,
    iconComponent: link.icon,
    target:        '_blank',
    rel:           'noopener',
    command:       () => window.open(link.url, '_blank', 'noopener'),
  })),
}]);

function toggleMenu(event: Event) {
  menuRef.value?.toggle(event);
}
</script>

<template>
  <div v-if="mode === 'inline'" class="research-links">
    <a
      v-for="link in links"
      :key="link.name"
      :href="link.url"
      target="_blank"
      rel="noopener"
      class="research-links__link"
      v-tooltip.bottom="link.name"
      :aria-label="`Research on ${ link.name }`"
      @click.stop
    >
      <component
        :is="link.icon"
        :width="link.iconSize ?? '24'"
        :height="link.iconSize ?? '24'"
      />
    </a>
  </div>

  <div v-else class="research-links research-links--dropdown" @click.stop>
    <Button
      icon="pi pi-external-link"
      size="small"
      severity="secondary"
      outlined
      rounded
      aria-label="Research links"
      v-tooltip.left="'Research links'"
      @click="toggleMenu"
    />
    <Menu
      ref="menuRef"
      :model="menuItems"
      :popup="true"
    >
      <template #submenuheader>
        <span class="text-primary font-bold">Research links</span>
      </template>
      <template #item="{ item, props }">
        <a class="flex items-center" v-bind="props.action">
          <component :is="item.iconComponent" width="24" height="24" />
          <span>{{ item.label }}</span>
        </a>
      </template>
    </Menu>
  </div>
</template>

<style lang="scss" scoped>
.research-links {
  display: flex;
  align-items: center;
  gap: 0.375rem;

  &__link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    color: var(--r-text-muted);
    opacity: 0.5;
    transition: opacity 0.15s ease, color 0.15s ease;
    text-decoration: none;

    &:hover {
      opacity: 1;
      color: var(--r-text-primary);
    }

    svg {
      width: 1.5rem;
      height: 1.5rem;
    }
  }
}

@media (max-width: 768px) {
  .research-links {
    gap: 1.25rem;
  }
}

</style>
