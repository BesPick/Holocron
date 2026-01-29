import { NextResponse, type NextRequest } from 'next/server';

const EXEMPT_PATHS = [
  '/api/clerk/webhook',
  '/api/cron/hosthub-shift-reminders',
  '/api/stream',
];

const EXEMPT_PREFIXES = ['/api/storage/image'];

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const rateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>();

const isTrustedOrigin = (request: NextRequest) => {
  const originHeader =
    request.headers.get('origin') ?? request.headers.get('referer');
  if (!originHeader) return false;
  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    return false;
  }
  const host = request.headers.get('host');
  if (!host) return false;
  return origin.host === host;
};

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith('/api')) {
    return NextResponse.next();
  }
  if (
    EXEMPT_PATHS.includes(pathname) ||
    EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  const ipHeader = request.headers.get('x-forwarded-for') ?? '';
  const ip =
    ipHeader.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
  } else {
    entry.count += 1;
    if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
    }
  }

  if (request.method === 'POST') {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
