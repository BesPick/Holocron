import Link from 'next/link';
import { Zap, ExternalLink } from 'lucide-react';

export const metadata = {
  title: 'Games | BESPIN Holocron',
};

const games = [
  {
    id: 'reaction-time',
    title: 'Reaction Time',
    description: 'Test your reflexes! Click as fast as you can when the screen turns green. Complete 5 rounds and see how you rank on the leaderboard.',
    icon: Zap,
    href: '/games/reaction-time',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
];

export default function GamesPage() {
  return (
    <section className='mx-auto w-full max-w-5xl px-4 py-16 space-y-10'>
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

      <div className='grid gap-6 sm:grid-cols-2'>
        {games.map((game) => {
          const Icon = game.icon;
          return (
            <Link
              key={game.id}
              href={game.href}
              target='_blank'
              rel='noopener noreferrer'
              className={`group relative rounded-2xl border ${game.borderColor} ${game.bgColor} p-6 transition-all hover:scale-[1.02] hover:shadow-lg`}
            >
              <div className='flex items-start justify-between'>
                <div className={`rounded-xl ${game.bgColor} p-3`}>
                  <Icon size={28} className={game.color} />
                </div>
                <ExternalLink size={18} className='text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100' />
              </div>
              <h3 className='mt-4 text-xl font-semibold text-foreground'>
                {game.title}
              </h3>
              <p className='mt-2 text-sm text-muted-foreground'>
                {game.description}
              </p>
              <div className='mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary'>
                Play now
                <ExternalLink size={14} />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
