import type { HostHubEventType } from '@/lib/hosthub-events';

export type CalendarDay = {
  date: Date;
  inMonth: boolean;
};

export type CalendarEvent = {
  id: string;
  dateKey: string;
  label: string;
  time: string;
  assignee?: string;
  assigneeId?: string | null;
  detail?: string;
  variant: HostHubEventType;
  isCanceled?: boolean;
};

export type EventOverride = {
  time: string | null;
  isCanceled: boolean;
  movedToDate?: string | null;
  overrideUserId?: string | null;
  overrideUserName?: string | null;
};

export type DemoMoveEntry = {
  sourceDate: string;
  override: EventOverride;
};
