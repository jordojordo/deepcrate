import type { ActivityItem } from '@/types';

interface ActivityMeta {
  icon:      string;
  iconColor: string;
  label:     string;
}

const META: Record<ActivityItem['type'], ActivityMeta> = {
  added:      {
    icon: 'pi-plus-circle',  iconColor: '#14b8a6',  label: 'Added to library'
  },
  approved:   {
    icon: 'pi-check-circle',  iconColor: '#22c55e',  label: 'Approved'
  },
  downloaded: {
    icon: 'pi-download',      iconColor: '#3b82f6',  label: 'Download finished'
  },
  rejected:   {
    icon: 'pi-times-circle',  iconColor: '#ef4444',    label: 'Rejected'
  },
  queued:     {
    icon: 'pi-clock',         iconColor: '#a855f7', label: 'Queued for approval'
  },
};

export function getActivityMeta(type: ActivityItem['type']): ActivityMeta {
  return META[type];
}

export function getAcivityIconStyle(type: ActivityItem['type']): string {
  const meta = getActivityMeta(type);

  return `color: ${ meta.iconColor }`;
}
