export interface ActivityItem {
  id:          string;
  title:       string;
  description: string;
  timestamp:   string;
  type:        'added' | 'approved' | 'rejected' | 'downloaded' | 'queued';
  coverUrl?:   string;
}
