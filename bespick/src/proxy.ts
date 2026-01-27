import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

const isAdminRoute = createRouteMatcher(['/morale/admin(.*)']);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const url = new URL(req.url);
  const { isAuthenticated } = await auth();

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
