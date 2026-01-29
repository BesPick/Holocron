export const metadata = {
  title: 'Games | BESPIN Holocron',
};

export default function GamesPage() {
  return (
    <section className='page-shell space-y-10'>
      <div className='rounded-3xl border border-border bg-linear-to-br from-primary/5 via-background to-background px-8 py-10 shadow'>
        <p className='text-sm font-semibold uppercase tracking-[0.3em] text-primary'>
          Tool
        </p>
        <h1 className='mt-4 text-4xl font-semibold text-foreground sm:text-5xl'>
          Games
        </h1>
        <p className='mt-4 text-base text-muted-foreground sm:text-lg'>
          Short, lightweight games for quick mental resets between tasks. Jump
          in when you need a short break and head back refreshed.
        </p>
      </div>

      <div className='rounded-2xl border border-dashed border-border bg-card/50 px-6 py-8 text-center text-sm text-muted-foreground'>
        The Games hub is in development. We&apos;ll add short mental-break games
        here soon.
      </div>
    </section>
  );
}
