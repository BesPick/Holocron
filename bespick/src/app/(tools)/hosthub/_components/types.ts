import type { HostHubEventType } from '@/lib/hosthub-events';

export type ShiftResource = {
  label: string;
  href: string;
};

export type ShiftEntry = {
  id: string;
  date: string;
  time: string;
  details: string;
  resources: ShiftResource[];
  eventType: HostHubEventType;
  eventDate: string;
};

export type ShiftSwapRequest = {
  id: string;
  eventType: HostHubEventType;
  eventDate: string;
  requesterId: string;
  requesterName: string | null;
  recipientId: string;
  recipientName: string | null;
  status: 'pending' | 'accepted' | 'denied' | 'expired';
  createdAt: number;
  updatedAt: number;
  respondedAt: number | null;
};

export type HostHubRosterMember = {
  userId: string;
  name: string;
};
