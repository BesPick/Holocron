'use client';

type RankChecklistProps<T extends string> = {
  title: string;
  ranks: readonly T[];
  selected: T[];
  disabled: boolean;
  onToggle: (rank: T) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  disabledMessage?: string;
};

export function RankChecklist<T extends string>({
  title,
  ranks,
  selected,
  disabled,
  onToggle,
  onSelectAll,
  onSelectNone,
  disabledMessage,
}: RankChecklistProps<T>) {
  return (
    <div>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm font-semibold text-foreground'>{title}</p>
        <div className='flex gap-2 text-xs text-muted-foreground'>
          <button
            type='button'
            onClick={onSelectAll}
            disabled={disabled}
            className='rounded-full border border-border px-2.5 py-1 transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60'
          >
            All
          </button>
          <button
            type='button'
            onClick={onSelectNone}
            disabled={disabled}
            className='rounded-full border border-border px-2.5 py-1 transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60'
          >
            None
          </button>
        </div>
      </div>
      <div className='mt-3 flex flex-wrap gap-2'>
        {ranks.map((rank) => (
          <label
            key={rank}
            className='inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-sm text-foreground shadow-sm'
          >
            <input
              type='checkbox'
              className='h-4 w-4 accent-primary'
              checked={selected.includes(rank)}
              onChange={() => onToggle(rank)}
              disabled={disabled}
            />
            {rank}
          </label>
        ))}
      </div>
      {disabledMessage ? (
        <p className='mt-2 text-xs text-muted-foreground'>
          {disabledMessage}
        </p>
      ) : null}
    </div>
  );
}
