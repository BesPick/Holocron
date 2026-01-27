'use client';

export type EditHistoryChange = {
  label: string;
  from: string;
  to: string;
};

export type EditHistoryEntry = {
  id: string;
  changedAt: number;
  changedByName: string;
  changes: EditHistoryChange[];
};

type EditHistoryModalProps = {
  title: string;
  entries: EditHistoryEntry[];
  onClose: () => void;
};

const formatTimestamp = (value: number) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export function EditHistoryModal({
  title,
  entries,
  onClose,
}: EditHistoryModalProps) {
  return (
    <div
      className='fixed inset-0 z-60 grid place-items-center bg-black/50 p-4'
      role='dialog'
      aria-modal='true'
      aria-label='Edit history'
      onClick={onClose}
    >
      <div
        className='w-full max-w-2xl rounded-3xl border border-border bg-background p-6 shadow-2xl'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground'>
              Edit History
            </p>
            <h3 className='mt-2 text-2xl font-semibold text-foreground'>
              {title}
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

        <div className='mt-5 space-y-4'>
          {entries.length === 0 ? (
            <div className='rounded-2xl border border-dashed border-border bg-card/50 px-6 py-8 text-center text-sm text-muted-foreground'>
              No edits have been recorded yet.
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className='rounded-2xl border border-border bg-card/60 p-4'
              >
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div>
                    <p className='text-sm font-semibold text-foreground'>
                      {entry.changedByName}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {formatTimestamp(entry.changedAt)}
                    </p>
                  </div>
                  <span className='rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
                    Updated
                  </span>
                </div>
                <ul className='mt-3 space-y-2 text-sm'>
                  {entry.changes.map((change) => (
                    <li key={`${entry.id}-${change.label}`}>
                      <span className='font-semibold text-foreground'>
                        {change.label}
                      </span>
                      <span className='text-muted-foreground'>
                        {' '}
                        {change.from} → {change.to}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
