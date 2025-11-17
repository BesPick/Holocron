import * as React from 'react';
import { Trash2 } from 'lucide-react';
interface PollOptionsSectionProps {
  isPoll: boolean;
  pollOptions: string[];
  onChangeOption: (index: number, value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
}

export function PollOptionsSection({
  isPoll,
  pollOptions,
  onChangeOption,
  onAddOption,
  onRemoveOption,
}: PollOptionsSectionProps) {
  if (!isPoll) {
    return null;
  }

  return (
    <div className='space-y-3 rounded-2xl border border-border bg-card/70 p-4'>
      <p className='text-sm font-medium text-foreground'>Poll Options</p>
      {pollOptions.map((option, index) => (
        <div className='flex items-center gap-2' key={`poll-option-${index}`}>
          <input
            type='text'
            value={option}
            onChange={(event) => onChangeOption(index, event.target.value)}
            placeholder={`Option ${index + 1}`}
            className='flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          />
          {index >= 2 && (
            <button
              type='button'
              onClick={() => onRemoveOption(index)}
              className='inline-flex items-center justify-center rounded-md border border-border bg-secondary p-2 text-foreground hover:opacity-90'
              aria-label={`Delete poll option ${index + 1}`}
            >
              <Trash2 className='h-4 w-4 text-destructive' aria-hidden='true' />
            </button>
          )}
        </div>
      ))}
      <button
        type='button'
        onClick={onAddOption}
        className='inline-flex items-center justify-center rounded-md border border-dashed border-border px-3 py-2 text-sm font-medium text-foreground hover:opacity-90'
      >
        Add Option
      </button>
    </div>
  );
}
