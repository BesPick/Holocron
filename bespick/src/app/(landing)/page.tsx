import Link from 'next/link';
import { AlertTriangle, Gamepad2, HeartPulse, Server } from 'lucide-react';
import { LandingBackgroundToggle } from '@/components/landing/landing-background-toggle';
import { MissingAssignmentsWarning } from '@/components/landing/missing-assignments-warning';
import {
  getProfileWarningConfig,
  getWarningBannerConfig,
} from '@/server/services/site-settings';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const warningBanner = await getWarningBannerConfig();
  const profileWarning = await getProfileWarningConfig();

  return (
    <section className='relative min-h-[calc(100vh-4rem)] w-full'>
      <LandingBackgroundToggle />
      <div className='mx-auto w-full max-w-5xl px-4 py-16 space-y-12 relative'>
        {warningBanner.enabled && warningBanner.message ? (
          <div className='rounded-2xl border border-amber-500/60 bg-[#483418] px-6 py-4 text-sm text-amber-100 shadow-sm'>
            <div className='flex items-start gap-3'>
              <AlertTriangle
                className='mt-0.5 h-5 w-5 text-amber-200'
                aria-hidden={true}
              />
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-amber-200'>
                  Notice
                </p>
                <p className='mt-1 whitespace-pre-line text-sm font-medium text-amber-100'>
                  {warningBanner.message}
                </p>
              </div>
            </div>
          </div>
        ) : null}
        <MissingAssignmentsWarning enabled={profileWarning.enabled} />
        <header className='rounded-3xl border border-border bg-linear-to-br from-primary/10 via-background to-background px-8 py-12 shadow'>
          <p className='text-sm font-semibold uppercase tracking-[0.35em] text-primary'>
            Tool Suite
          </p>
          <h1 className='mt-4 text-4xl font-semibold text-foreground sm:text-5xl'>
            BESPIN Holocron
          </h1>
          <p className='mt-4 text-base text-muted-foreground sm:text-lg'>
            Your one-stop hub for mission-ready tools. Choose a module to get
            started, or check back as new systems come online.
          </p>
        </header>

        <div className='grid gap-6 md:grid-cols-3'>
          <Link
            href='/hosthub'
            className='group rounded-3xl border border-border bg-card/70 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md'
          >
            <div className='flex items-center gap-3'>
              <span className='inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary'>
                <Server className='h-6 w-6' aria-hidden={true} />
              </span>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
                  In Development
                </p>
                <h2 className='text-xl font-semibold text-foreground'>
                  HostHub
                </h2>
              </div>
            </div>
            <p className='mt-4 text-sm text-muted-foreground'>
              Centralized host operations, scheduling, and utilities are on
              deck.
              <br />
              <span className='block' aria-hidden={true}>
                &nbsp;
              </span>
            </p>
            <span className='mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary'>
              In development
            </span>
          </Link>

          <Link
            href='/morale'
            className='group rounded-3xl border border-border bg-card/70 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md'
          >
            <div className='flex items-center gap-3'>
              <span className='inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary'>
                <HeartPulse className='h-6 w-6' aria-hidden={true} />
              </span>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
                  Live Tool
                </p>
                <h2 className='text-xl font-semibold text-foreground'>
                  Morale
                </h2>
              </div>
            </div>
            <p className='mt-4 text-sm text-muted-foreground'>
              Announcements, polls, voting events, and morale funding—all in one
              command center.
            </p>
            <span className='mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary'>
              Enter Morale
              <span aria-hidden={true}>→</span>
            </span>
          </Link>

          <Link
            href='/games'
            className='group rounded-3xl border border-border bg-card/70 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md'
          >
            <div className='flex items-center gap-3'>
              <span className='inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary'>
                <Gamepad2 className='h-6 w-6' aria-hidden={true} />
              </span>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
                  In Development
                </p>
                <h2 className='text-xl font-semibold text-foreground'>Games</h2>
              </div>
            </div>
            <p className='mt-4 text-sm text-muted-foreground'>
              Quick mental-break games for short, focused resets between tasks
              are on deck.
            </p>
            <span className='mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary'>
              In development
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
