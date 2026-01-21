'use client';

import type { CalendarEvent, EventOverride } from './calendar-types';
import {
  DEMO_TONE,
  MY_TONE,
  SECURITY_TONE,
  STANDUP_TONE,
} from './calendar-constants';
import { formatFullDate, parseDateKey } from './calendar-utils';
import {
  getHostHubEventLabel,
  isSecurityShiftEventType,
} from '@/lib/hosthub-events';

type ScheduleDetailsModalProps = {
  selectedDate: Date;
  events: CalendarEvent[];
  currentUserId: string | null;
  isAdmin: boolean;
  rosterOptions: Array<{ userId: string; name: string }>;
  editingEventId: string | null;
  editTime: string;
  editCanceled: boolean;
  editMovedDate: string;
  editHostId: string;
  editMessage: string | null;
  isSaving: boolean;
  getOverrideForEvent: (event: CalendarEvent) => EventOverride | undefined;
  onClose: () => void;
  onOpenEdit: (event: CalendarEvent) => void;
  onSaveEdit: (event: CalendarEvent) => void;
  onResetEdit: (event: CalendarEvent) => void;
  onEditTimeChange: (value: string) => void;
  onEditMovedDateChange: (value: string) => void;
  onEditHostIdChange: (value: string) => void;
  onEditCanceledChange: (value: boolean) => void;
  onCloseEdit: () => void;
};

export function ScheduleDetailsModal({
  selectedDate,
  events,
  currentUserId,
  isAdmin,
  rosterOptions,
  editingEventId,
  editTime,
  editCanceled,
  editMovedDate,
  editHostId,
  editMessage,
  isSaving,
  getOverrideForEvent,
  onClose,
  onOpenEdit,
  onSaveEdit,
  onResetEdit,
  onEditTimeChange,
  onEditMovedDateChange,
  onEditHostIdChange,
  onEditCanceledChange,
  onCloseEdit,
}: ScheduleDetailsModalProps) {
  return (
    <div
      className='fixed inset-0 z-60 grid place-items-center bg-black/50 p-4'
      role='dialog'
      aria-modal='true'
      aria-label='Schedule details'
      onClick={onClose}
    >
      <div
        className='w-full max-w-xl rounded-3xl border border-border bg-background p-6 shadow-2xl'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground'>
              Schedule Details
            </p>
            <h3 className='mt-2 text-2xl font-semibold text-foreground'>
              {formatFullDate(selectedDate)}
            </h3>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary/70'
          >
            Close
          </button>
        </div>

        <div className='mt-5 space-y-3'>
          {events.length > 0 ? (
            events.map((event) => {
              const isMine =
                event.assigneeId && event.assigneeId === currentUserId;
              const tone = isMine
                ? MY_TONE
                : event.variant === 'standup'
                  ? STANDUP_TONE
                  : isSecurityShiftEventType(event.variant)
                    ? SECURITY_TONE
                    : DEMO_TONE;
              const override = getOverrideForEvent(event);
              const originalDemoDate =
                event.variant === 'demo'
                  ? parseDateKey(event.dateKey)
                  : null;
              const isEditing = editingEventId === event.id;
              return (
                <div
                  key={event.id}
                  className={`rounded-2xl border p-4 ${tone.card}`}
                >
                  <div className='flex items-center justify-between gap-2'>
                    <div>
                      <p className='text-sm font-semibold text-foreground'>
                        {event.label}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {event.time}
                      </p>
                    </div>
                    <div className='flex items-center gap-2'>
                      {event.isCanceled ? (
                        <span className='rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
                          Canceled
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${tone.badge}`}
                      >
                        {getHostHubEventLabel(event.variant)}
                      </span>
                    </div>
                  </div>
                  {event.assignee ? (
                    <p className='mt-2 text-sm text-muted-foreground'>
                      Assigned:{' '}
                      <span className='text-foreground'>
                        {event.assignee}
                      </span>
                    </p>
                  ) : null}
                  {event.detail ? (
                    <p className='mt-2 text-sm text-muted-foreground'>
                      {event.detail}
                    </p>
                  ) : null}
                  {isAdmin ? (
                    <div className='mt-4 rounded-xl border border-border bg-background/70 p-3'>
                      <div className='flex flex-wrap items-center justify-between gap-2'>
                        <p className='text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
                          Admin override
                        </p>
                        {!isEditing ? (
                          <button
                            type='button'
                            onClick={() => onOpenEdit(event)}
                            className='rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:bg-secondary/70'
                          >
                            Edit event
                          </button>
                        ) : null}
                      </div>
                      {isEditing ? (
                        <div className='mt-3 space-y-3'>
                          <label className='flex flex-col gap-2 text-sm text-foreground'>
                            Host override
                            <select
                              value={editHostId}
                              onChange={(eventValue) =>
                                onEditHostIdChange(eventValue.target.value)
                              }
                              disabled={isSaving || rosterOptions.length === 0}
                              className='w-full max-w-64 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
                            >
                              <option value=''>
                                Use assigned host ({event.assignee ?? 'TBD'})
                              </option>
                              {rosterOptions.map((member) => (
                                <option key={member.userId} value={member.userId}>
                                  {member.name}
                                </option>
                              ))}
                            </select>
                            <span className='text-xs text-muted-foreground'>
                              All members are available, even if they do not meet
                              eligibility rules.
                            </span>
                            {rosterOptions.length === 0 ? (
                              <span className='text-xs text-muted-foreground'>
                                No roster data available for overrides.
                              </span>
                            ) : null}
                          </label>
                          {!isSecurityShiftEventType(event.variant) ? (
                            <label className='flex flex-col gap-2 text-sm text-foreground'>
                              Time
                              <input
                                type='time'
                                value={editTime}
                                onChange={(eventValue) =>
                                  onEditTimeChange(eventValue.target.value)
                                }
                                disabled={isSaving}
                                className='w-full max-w-40 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                              />
                            </label>
                          ) : null}
                          {event.variant === 'demo' ? (
                            <label className='flex flex-col gap-2 text-sm text-foreground'>
                              Move date
                              <input
                                type='date'
                                value={editMovedDate}
                                onChange={(eventValue) =>
                                  onEditMovedDateChange(eventValue.target.value)
                                }
                                disabled={isSaving}
                                className='w-full max-w-50 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                              />
                              {originalDemoDate ? (
                                <span className='text-xs text-muted-foreground'>
                                  Original date:{' '}
                                  {formatFullDate(originalDemoDate)}
                                </span>
                              ) : null}
                            </label>
                          ) : null}
                          <label className='inline-flex items-center gap-2 text-sm text-foreground'>
                            <input
                              type='checkbox'
                              checked={editCanceled}
                              onChange={(eventValue) =>
                                onEditCanceledChange(eventValue.target.checked)
                              }
                              disabled={isSaving}
                              className='h-4 w-4 accent-primary'
                            />
                            Mark as canceled
                          </label>
                          {editMessage ? (
                            <p className='text-xs text-muted-foreground'>
                              {editMessage}
                            </p>
                          ) : null}
                          <div className='flex flex-wrap items-center gap-2'>
                            <button
                              type='button'
                              onClick={() => onSaveEdit(event)}
                              disabled={isSaving}
                              className='rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            {override ? (
                              <button
                                type='button'
                                onClick={() => onResetEdit(event)}
                                disabled={isSaving}
                                className='rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
                              >
                                Reset
                              </button>
                            ) : null}
                            <button
                              type='button'
                              onClick={onCloseEdit}
                              className='rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary/70'
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className='rounded-2xl border border-dashed border-border bg-card/50 px-6 py-8 text-center text-sm text-muted-foreground'>
              No matching shifts for this day.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
