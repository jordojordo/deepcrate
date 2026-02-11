export interface ActivityItem {
  id:          string;
  title:       string;
  description: string;
  timestamp:   string;
  type:        'added' | 'approved' | 'downloaded' | 'queued' | 'system';
  coverUrl?:   string;
}
