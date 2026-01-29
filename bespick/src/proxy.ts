import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { verifyCsrfOrigin } from '@/server/security/csrf';
import { checkRateLimit, getRateLimitHeaders } from '@/server/security/rate-limit';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

const isAdminRoute = createRouteMatcher(['/morale/admin(.*)']);

const isApiRoute = createRouteMatcher(['/api(.*)']);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const url = new URL(req.url);
  const { isAuthenticated } = await auth();

  // Rate limiting for API routes
  if (isApiRoute(req)) {
    const rateLimitResult = checkRateLimit(req);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        },
      );
    }
  }

  // CSRF protection for API routes with state-changing methods
  if (isApiRoute(req) && !verifyCsrfOrigin(req)) {
    return NextResponse.json(
      { error: 'Invalid request origin.' },
      { status: 403 },
    );
  }

  // Public routes: allow through
  if (isPublicRoute(req)) return;

  // Require auth for everything else; redirect signed out users to /sign-up
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL('/sign-up', url.origin));
  }

  // Protect all routes starting with `/morale/admin`
  if (isAdminRoute(req)) {
    const role = (await auth()).sessionClaims?.metadata?.role ?? '';
    if (
      role !== 'admin' &&
      role !== 'moderator' &&
      role !== 'morale-member'
    ) {
      const url = new URL('/', req.url);
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
