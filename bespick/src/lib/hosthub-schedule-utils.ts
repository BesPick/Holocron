export const isFirstWednesday = (date: Date) =>
  date.getDay() === 3 && date.getDate() <= 7;

export const formatShortDateLabel = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);

export const resolveEventTime = (
  overrideTime: string | null | undefined,
  defaultTime: string,
) => {
  if (overrideTime && overrideTime.trim()) return overrideTime;
  if (defaultTime && defaultTime.trim()) return defaultTime;
  return 'TBD';
};

export const formatTimeRange = (startTime: string, endTime: string) => {
  if (!startTime || startTime.trim() === '' || startTime === 'TBD') {
    return 'TBD';
  }
  return `${startTime}-${endTime}`;
};
