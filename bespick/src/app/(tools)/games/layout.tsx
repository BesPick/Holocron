import type { ReactNode } from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

type GamesLayoutProps = {
  children: ReactNode;
};

export default function GamesLayout({ children }: GamesLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-card/80 backdrop-blur supports-backdrop-filter:bg-card/60">
        <div className="mx-auto flex h-16 w-full max-w-8xl items-center justify-between px-5">
          <Link
            href="/games"
            className="text-lg font-semibold tracking-tight transition hover:text-primary hover:scale-110 sm:text-xl"
            aria-label="Go to games"
          >
            BESPIN Games
          </Link>
          <div className="flex items-center gap-3">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'h-10 w-10',
                },
              }}
            />
          </div>
        </div>
      </header>
      <main className="flex-1 pt-16">{children}</main>
    </div>
  );
}
