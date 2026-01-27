export type HostHubEventType =
  | 'standup'
  | 'demo'
  | 'building-892'
  | 'security-am'
  | 'security-pm';

export const HOSTHUB_EVENT_TYPES = [
  'standup',
  'demo',
  'building-892',
  'security-am',
  'security-pm',
] as const;

export const SECURITY_SHIFT_EVENT_TYPES = [
  'security-am',
  'security-pm',
] as const;

export type SecurityShiftEventType =
  (typeof SECURITY_SHIFT_EVENT_TYPES)[number];

export const SECURITY_SHIFT_WINDOWS: Record<
  SecurityShiftEventType,
  { label: string; startTime: string; endTime: string }
> = {
  'security-am': {
    label: 'Morning',
    startTime: '07:00',
    endTime: '12:00',
  },
  'security-pm': {
    label: 'Afternoon',
    startTime: '12:00',
    endTime: '16:30',
  },
};

export const isHostHubEventType = (
  value: unknown,
): value is HostHubEventType =>
  HOSTHUB_EVENT_TYPES.includes(value as HostHubEventType);

export const isSecurityShiftEventType = (
  value: HostHubEventType,
): value is SecurityShiftEventType =>
  SECURITY_SHIFT_EVENT_TYPES.includes(value as SecurityShiftEventType);

export const getHostHubEventLabel = (value: HostHubEventType) => {
  if (value === 'standup') return 'Standup';
  if (value === 'demo') return 'Demo Day';
  if (value === 'building-892') return '892 Manning';
  return 'Security Shift';
};

export const getSecurityShiftWindow = (value: HostHubEventType) =>
  isSecurityShiftEventType(value)
    ? SECURITY_SHIFT_WINDOWS[value]
    : null;

export const isValidDateKey = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value);

export const isValidTimeValue = (value: string) => {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

export const getEventOverrideId = (
  date: string,
  eventType: HostHubEventType,
) => `${eventType}-${date}`;
