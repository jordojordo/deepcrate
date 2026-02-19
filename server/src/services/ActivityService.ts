import type { ActivityItem } from '@server/types/activity';

import { Op } from '@sequelize/core';

import QueueItem from '@server/models/QueueItem';
import DownloadTask from '@server/models/DownloadTask';

export interface PaginatedActivity {
  items: ActivityItem[];
  total: number;
}

/**
 * Aggregates recent events from QueueItem and DownloadTask
 */
export class ActivityService {
  async getRecent(params: { limit: number; offset: number }): Promise<PaginatedActivity> {
    const { limit, offset } = params;

    const [queueResult, downloadResult] = await Promise.all([
      this.getAllQueueItems(),
      this.getAllDownloadTasks(),
    ]);

    const activities: ActivityItem[] = [
      ...queueResult.rows.map(item => this.mapQueueItemToActivity(item)),
      ...downloadResult.rows.map(task => this.mapDownloadTaskToActivity(task)),
    ];

    activities.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const total = queueResult.count + downloadResult.count;

    return {
      items: activities.slice(offset, offset + limit),
      total,
    };
  }

  private async getAllQueueItems(): Promise<{ rows: QueueItem[]; count: number }> {
    return QueueItem.findAndCountAll({
      where: { status: { [Op.in]: ['pending', 'approved', 'rejected'] } },
      order: [
        ['processedAt', 'DESC'],
        ['addedAt', 'DESC'],
      ],
    });
  }

  private async getAllDownloadTasks(): Promise<{ rows: DownloadTask[]; count: number }> {
    return DownloadTask.findAndCountAll({
      where: { status: 'completed' },
      order: [['completedAt', 'DESC']],
    });
  }

  private mapQueueItemToActivity(item: QueueItem): ActivityItem {
    const label = `${ item.artist } - ${ item.album ? item.album : item.title ?? 'Unknown' }`;

    const typeMap = {
      pending:  'queued',
      approved: 'approved',
      rejected: 'rejected',
    } as const;

    const descriptionMap = {
      pending:  'Queued for approval',
      approved: 'Approved',
      rejected: 'Rejected',
    } as const;

    const type = typeMap[item.status];
    const timestamp = item.processedAt ?? item.addedAt;

    return {
      id:          `queue-${ item.id }`,
      title:       label,
      description: descriptionMap[item.status],
      timestamp:   timestamp.toISOString(),
      type,
      coverUrl:    item.coverUrl ?? undefined,
    };
  }

  private mapDownloadTaskToActivity(task: DownloadTask): ActivityItem {
    return {
      id:          `download-${ task.id }`,
      title:       `${ task.artist } - ${ task.album }`,
      description: 'Download finished',
      timestamp:   (task.completedAt ?? task.queuedAt).toISOString(),
      type:        'downloaded',
    };
  }
}

export default ActivityService;
