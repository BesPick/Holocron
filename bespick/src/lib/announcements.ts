import type { Doc } from '@/types/db';

type AnnouncementDoc = Doc<'announcements'>;

export function formatEventType(type: AnnouncementDoc['eventType']) {
  return type
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatCreator(createdBy?: string | null) {
  if (!createdBy || createdBy === 'anonymous') return 'Anonymous';
  if (createdBy.includes(':')) {
    return createdBy.split(':')[0];
  }
  if (createdBy.includes('|')) {
    return createdBy.split('|')[0];
  }
  return createdBy;
}

export function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}
