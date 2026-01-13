<script setup lang="ts">
import Button from 'primevue/button';

export interface ActivityItem {
  id:          string;
  title:       string;
  description: string;
  timestamp:   string;
  type:        'added' | 'approved' | 'downloaded' | 'queued' | 'system';
  coverUrl?:   string;
}

interface Props {
  activities: ActivityItem[];
  title?:     string;
  maxHeight?: string;
}

withDefaults(defineProps<Props>(), {
  title:     'Recent Activity',
  maxHeight: '400px',
});

defineEmits<{
  viewAll: [];
}>();

// Get icon and color based on activity type
const getActivityMeta = (type: ActivityItem['type']) => {
  const meta = {
    added: {
      icon:      'pi-plus-circle',
      iconColor: 'text-green-500',
      label:     'Added to library',
    },
    approved: {
      icon:      'pi-check-circle',
      iconColor: 'text-green-500',
      label:     'Approved',
    },
    downloaded: {
      icon:      'pi-download',
      iconColor: 'text-green-500',
      label:     'Download finished',
    },
    queued: {
      icon:      'pi-clock',
      iconColor: 'text-yellow-500',
      label:     'Queued for approval',
    },
    system: {
      icon:      'pi-sync',
      iconColor: 'text-primary',
      label:     'System',
    },
  };

  return meta[type];
};

// Default cover placeholder
const getDefaultCover = () => {
  return 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" fill="#282839"/>
      <circle cx="24" cy="24" r="12" stroke="#6b6b8a" stroke-width="2" fill="none"/>
      <circle cx="24" cy="24" r="4" fill="#6b6b8a"/>
    </svg>
  `);
};
</script>

<template>
  <div class="glass-panel p-6 flex flex-column h-full">
    <!-- Header -->
    <div class="flex align-items-center justify-content-between mb-6">
      <h3 class="text-xl font-bold text-white">{{ title }}</h3>
      <Button
        label="View All"
        class="activity-feed__view-all"
        link
        @click="$emit('viewAll')"
      />
    </div>

    <!-- Activity list -->
    <div
      class="activity-feed__list overflow-y-auto pr-2"
      :style="{ maxHeight }"
    >
      <div v-if="activities.length === 0" class="text-center py-8">
        <i class="pi pi-inbox text-4xl text-white/20 mb-3"></i>
        <p class="text-white/40 text-sm">No recent activity</p>
      </div>

      <div
        v-for="activity in activities"
        :key="activity.id"
        class="activity-feed__item group"
      >
        <!-- Cover or system icon -->
        <div v-if="activity.type === 'system'" class="activity-feed__icon activity-feed__icon--system">
          <i :class="['pi', getActivityMeta(activity.type).icon, 'text-primary']"></i>
        </div>
        <div v-else class="activity-feed__cover">
          <img
            :src="activity.coverUrl || getDefaultCover()"
            :alt="activity.title"
            class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            @error="($event.target as HTMLImageElement).src = getDefaultCover()"
          />
        </div>

        <!-- Content -->
        <div class="flex flex-column flex-1 justify-content-center min-w-0">
          <p class="text-sm font-medium text-white group-hover:text-primary transition-colors truncate">
            {{ activity.title }}
          </p>
          <div class="flex align-items-center gap-2 text-xs text-white/40 mt-1">
            <i
              :class="[
                'pi',
                getActivityMeta(activity.type).icon,
                getActivityMeta(activity.type).iconColor,
                'text-xs'
              ]"
            ></i>
            <span>{{ activity.description }}</span>
            <span>&bull;</span>
            <span>{{ activity.timestamp }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.activity-feed__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-feed__item {
  display: flex;
  gap: 1rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.5rem;
  transition: background-color 0.15s ease;
}

.activity-feed__item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.activity-feed__cover {
  width: 3rem;
  height: 3rem;
  border-radius: 0.375rem;
  background-color: var(--surface-700);
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.activity-feed__icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.375rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.activity-feed__icon--system {
  background-color: rgba(43, 43, 238, 0.1);
  border: 1px solid rgba(43, 43, 238, 0.2);
}

.activity-feed__icon i {
  font-size: 1.25rem;
}

/* View all button styling */
:deep(.activity-feed__view-all) {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--primary-500);
  padding: 0;
}

:deep(.activity-feed__view-all:hover) {
  color: white;
}
</style>
