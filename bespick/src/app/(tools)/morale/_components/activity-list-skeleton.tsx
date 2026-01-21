'use client';

export function ActivityListSkeleton() {
  return (
    <div className='space-y-4'>
      {Array.from({ length: 3 }).map((_, idx) => (
        <div
          key={idx}
          className='animate-pulse rounded-xl border border-border bg-card/60 p-6'
        >
          <div className='h-4 w-24 rounded-full bg-muted' />
          <div className='mt-4 h-6 w-3/4 rounded bg-muted' />
          <div className='mt-3 h-4 w-full rounded bg-muted' />
          <div className='mt-2 h-4 w-5/6 rounded bg-muted' />
        </div>
      ))}
    </div>
  );
}
