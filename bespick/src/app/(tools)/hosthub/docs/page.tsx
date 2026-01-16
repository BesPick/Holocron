import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

import { HostHubSubHeader } from '@/components/header/hosthub-subheader';
import {
  ensureDemoDayAssignmentsForWindow,
  getEligibleDemoDayRoster,
  listDemoDayHistory,
} from '@/server/services/hosthub-schedule';
import {
  DEMO_DAY_DOC_URL,
  STANDUP_ABOUT_ME_GUIDELINES_URL,
  STANDUP_SCHEDULE_PDF_URL,
  STANDUP_SCHEDULE_PREVIEW_URL,
} from '@/lib/hosthub-docs';

export const metadata = {
  title: 'Docs | HostHub',
};

const formatDemoDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export default async function HostHubDocsPage() {
  const eligibleRoster = await getEligibleDemoDayRoster();
  await ensureDemoDayAssignmentsForWindow({
    baseDate: new Date(),
    eligibleUsers: eligibleRoster,
  });
  const demoHistory = await listDemoDayHistory();

  return (
    <section className='mx-auto w-full max-w-5xl px-4 py-16 space-y-10'>
      <HostHubSubHeader />
      <div className='rounded-2xl border border-border bg-card/70 p-6 shadow-sm space-y-6'>
        <div>
          <h2 className='text-2xl font-semibold text-foreground'>
            Policies
          </h2>
          <p className='mt-2 text-sm text-muted-foreground'>
            Formal shift rules and expectations for hosts.
          </p>
          <ul className='mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground'>
            <li>If you are assigned, you are responsible for coordinating and running the event.</li>
            <li>If you are unavailable, you must find a replacement and coordinate the swap.</li>
            <li>Notify an admin once a replacement is confirmed so the calendar can be updated.</li>
            <li>Come prepared with any materials or context needed for the session and be early to google meetings.</li>
          </ul>
        </div>

        <details className='border-t border-border pt-6'>
          <summary className='flex cursor-pointer list-none items-center justify-between text-2xl font-semibold text-foreground'>
            <span>Standup Documentation</span>
            <ChevronDown className='h-5 w-5 text-muted-foreground' aria-hidden={true} />
          </summary>
          <div className='mt-4 space-y-6'>
            <details className='rounded-2xl border border-border bg-background/70 px-4 py-3'>
              <summary className='flex cursor-pointer list-none items-center justify-between text-base font-semibold text-foreground'>
                <span>Standup Schedule</span>
                <ChevronDown className='h-4 w-4 text-muted-foreground' aria-hidden={true} />
              </summary>
              <div className='mt-4 space-y-4'>
                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <p className='text-sm text-muted-foreground'>
                    Review the current standup schedule. You can preview it
                    here or download the PDF for offline use.
                  </p>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Link
                      href={STANDUP_SCHEDULE_PDF_URL}
                      className='inline-flex items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary/70'
                    >
                      Download PDF
                    </Link>
                  </div>
                </div>
                <div className='aspect-4/3 w-full overflow-hidden rounded-2xl border border-border bg-background'>
                  <iframe
                    title='Standup schedule'
                    src={STANDUP_SCHEDULE_PREVIEW_URL}
                    className='h-full w-full'
                  />
                </div>
              </div>
            </details>

            <div className='rounded-2xl border border-border bg-background/70 px-4 py-4'>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                  <p className='text-base font-semibold text-foreground'>
                    "About Me" Guidelines
                  </p>
                  <p className='mt-1 text-sm text-muted-foreground'>
                    Reference guidelines and expectations for About Me slides.
                  </p>
                </div>
                <Link
                  href={STANDUP_ABOUT_ME_GUIDELINES_URL}
                  className='inline-flex items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary/70'
                >
                  Open Document
                </Link>
              </div>
            </div>
          </div>
        </details>

        <details className='border-t border-border pt-6'>
          <summary className='flex cursor-pointer list-none items-center justify-between text-2xl font-semibold text-foreground'>
            <span>Demo Day Documentation</span>
            <ChevronDown className='h-5 w-5 text-muted-foreground' aria-hidden={true} />
          </summary>
          <div className='mt-4 space-y-6'>
            <div className='rounded-2xl border border-border bg-background/70 px-4 py-4'>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                  <p className='text-base font-semibold text-foreground'>
                    Demo Day Documentation
                  </p>
                  <p className='mt-1 text-sm text-muted-foreground'>
                    Reference material for Demo Day expectations and prep steps.
                  </p>
                </div>
                <Link
                  href={DEMO_DAY_DOC_URL}
                  className='inline-flex items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary/70'
                >
                  Open Document
                </Link>
              </div>
            </div>
          </div>
        </details>

        <details className='border-t border-border pt-6'>
          <summary className='flex cursor-pointer list-none items-center justify-between text-2xl font-semibold text-foreground'>
            <span>FAQs</span>
            <ChevronDown className='h-5 w-5 text-muted-foreground' aria-hidden={true} />
          </summary>
          <p className='mt-2 text-sm text-muted-foreground'>
            Quick answers for common questions.
          </p>
          <div className='mt-4 space-y-4 text-sm text-muted-foreground'>
            <div>
              <p className='font-semibold text-foreground'>
                If it is Monday, are the "About Me" slides required?
              </p>
              <p className='mt-1'>
                Yes, if you are the assigned standup host for that day. Use the
                guidelines doc for format and any approved exceptions.
              </p>
            </div>
            <div>
              <p className='font-semibold text-foreground'>
                How are assignees selected?
              </p>
              <p className='mt-1'>
                Assignments are random within the eligibility settings in the
                Schedule tab. The system rotates through everyone before
                repeating and only schedules the current month.
              </p>
            </div>
            <div>
              <p className='font-semibold text-foreground'>
                How do I switch an assignment?
              </p>
              <p className='mt-1'>
                Coordinate with another eligible teammate, then ask an admin to
                update the assignment. The assigned host is responsible for
                securing a replacement if they are unavailable.
              </p>
            </div>
            <div>
              <p className='font-semibold text-foreground'>
                Why are some future events marked TBD?
              </p>
              <p className='mt-1'>
                Only the current month is assigned. Future months show the
                event placeholders so you can plan ahead.
              </p>
            </div>
            <div>
              <p className='font-semibold text-foreground'>
                Can I view only my shifts?
              </p>
              <p className='mt-1'>
                Yes. Use the "My Shifts Only" filter on the Calendar tab to
                hide events that are not assigned to you.
              </p>
            </div>
            <div>
              <p className='font-semibold text-foreground'>
                Who do I contact with feedback or issues?
              </p>
              <p className='mt-1'>
                Send feedback to an admin so they can review and
                prioritize updates. (andrew.odom@teambespin.us)
              </p>
            </div>
          </div>
        </details>

        <details className='border-t border-border pt-6'>
          <summary className='flex cursor-pointer list-none items-center justify-between text-2xl font-semibold text-foreground'>
            <span>Demo Day history</span>
            <ChevronDown className='h-5 w-5 text-muted-foreground' aria-hidden={true} />
          </summary>
          <div className='mt-4 space-y-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>
                  Completed Demo Day assignments are logged here with the date
                  and assignee.
                </p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Showing the last 12 months.
                </p>
              </div>
              <Link
                href='/api/hosthub/demo-day-history'
                className='inline-flex items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary/70'
              >
                Download CSV
              </Link>
            </div>

            {demoHistory.length === 0 ? (
              <div className='rounded-2xl border border-dashed border-border bg-card/50 px-6 py-8 text-center text-sm text-muted-foreground'>
                No Demo Day history yet.
              </div>
            ) : (
              <div className='rounded-2xl border border-border bg-background/70'>
                <div className='grid grid-cols-2 gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
                  <span>Date</span>
                  <span>Assignee</span>
                </div>
                <ul className='max-h-64 divide-y divide-border overflow-y-auto text-sm text-foreground'>
                  {demoHistory.map((entry) => (
                    <li
                      key={entry.date}
                      className='grid grid-cols-2 gap-3 px-4 py-3'
                    >
                      <span>{formatDemoDate(entry.date)}</span>
                      <span className='text-muted-foreground'>
                        {entry.userName}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}
