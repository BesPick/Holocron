import Link from 'next/link';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import { Geist, Geist_Mono } from 'next/font/google';
import { HeaderActions } from '@/components/header/header-actions';
import { MetadataOptionsProvider } from '@/components/metadata/metadata-options-provider';
import './globals.css';
import { shadcn } from '@clerk/themes';
import packageJson from '../../package.json';
import { getMetadataOptionsConfig } from '@/server/services/site-settings';

export const metadata = {
  title: 'BESPIN Holocron',
  description: 'BESPIN Holocron Tool Suite',
};

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const appVersion =
  process.env.NEXT_PUBLIC_APP_VERSION ?? packageJson.version;
const appCommit = process.env.NEXT_PUBLIC_GIT_SHA;
const appBuildLabel = appCommit
  ? `${appVersion} (${appCommit.slice(0, 7)})`
  : appVersion;

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const metadataOptions = await getMetadataOptionsConfig();
  return (
    <ClerkProvider
      appearance={{
        baseTheme: shadcn,
        layout: {
          unsafe_disableDevelopmentModeWarnings: true,
        },
        variables: {
          fontFamily:
            'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        userButton: {
          elements: {
            avatarBox: 'h-10 w-10',
            userButtonPopoverCard:
              'bg-card text-foreground border border-border shadow-2xl rounded-2xl',
            userButtonPopoverFooter:
              'bg-accent text-foreground border-t border-border rounded-b-2xl',
          },
        },
        userProfile: {
          elements: {
            card:
              'bg-card text-foreground border border-border shadow-2xl rounded-t',
            modalContent: 'bg-background text-foreground rounded-2xl',
            page: 'bg-background text-foreground',
            navbar: 'bg-card border-b border-border rounded-t',
          },
        },
      }}
      signInUrl='/sign-in'
      signUpUrl='/sign-up'
    >
      <html lang='en' suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground font-sans antialiased`}
        >
          <Script id='theme-sync' strategy='beforeInteractive'>{`(() => {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    if (media.matches) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };
  apply();
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', apply);
  } else if (typeof media.addListener === 'function') {
    media.addListener(apply);
  }
})();`}</Script>
          <MetadataOptionsProvider options={metadataOptions}>
            <div className='flex min-h-screen flex-col'>
              {/* Header */}
              <header className='fixed inset-x-0 top-0 z-50 border-b border-border bg-card/80 backdrop-blur supports-backdrop-filter:bg-card/60'>
                <div className='mx-auto flex h-16 w-full max-w-8xl items-center justify-between px-5'>
                  <Link
                    href='/'
                    className='text-lg font-semibold tracking-tight transition hover:text-primary hover:scale-110 sm:text-xl'
                    aria-label='Go to home'
                  >
                    BESPIN Holocron
                  </Link>
                  <div className='relative flex items-center'>
                    <HeaderActions />
                  </div>
                </div>
              </header>
              {/* Main content */}
              <main className='flex-1 pt-16'>{children}</main>
              <footer className='border-t border-border bg-card/60'>
                <div className='mx-auto flex w-full max-w-8xl flex-col items-center justify-between gap-1 px-5 py-3 text-xs text-muted-foreground sm:flex-row'>
                  <span>BESPIN Holocron</span>
                  <span>Version {appBuildLabel}</span>
                </div>
              </footer>
            </div>
          </MetadataOptionsProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
