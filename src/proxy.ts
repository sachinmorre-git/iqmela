import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  '/candidate(.*)',
  '/interviewer(.*)',
  '/org-admin(.*)',
  '/admin(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  if (userId) {
    // Clerk's session token is the authoritative source of truth.
    // It is cryptographically signed by Clerk and cannot be spoofed.
    const tokenRole = (sessionClaims?.publicMetadata as Record<string, any>)?.role as string | undefined;

    // Normalize: Prisma enum "admin" → URL segment "org-admin"
    const normalizedTokenRole = tokenRole === "admin" ? "org-admin" : tokenRole;

    const cookieRole = req.cookies.get("user_role")?.value;

    // 🔥 THE CORE FIX: If Clerk says one role but the cookie says another,
    // the cookie is STALE (e.g. from a previous account session or role change).
    // Overwrite it immediately and redirect so the next request is clean.
    if (normalizedTokenRole && cookieRole && normalizedTokenRole !== cookieRole) {
      const response = NextResponse.redirect(req.nextUrl);
      response.cookies.set("user_role", normalizedTokenRole, { path: "/" });
      return response;
    }

    // Determine the active role — prefer the verified token, fall back to cookie
    const activeRole = normalizedTokenRole || cookieRole;

    // 1. If visiting /select-role but already has a role, redirect to their dashboard
    if (req.nextUrl.pathname === '/select-role' && activeRole) {
      // Allow overriding with ?force=true (e.g. to switch roles)
      if (!req.nextUrl.searchParams.has('force')) {
        return NextResponse.redirect(new URL(`/${activeRole}/dashboard`, req.url));
      }
    }

    // 2. If hitting a protected route with no role, send to select-role
    if (isProtectedRoute(req) && !activeRole) {
      return NextResponse.redirect(new URL('/select-role', req.url));
    }
  }

  // Enforce global auth protection on all dashboard routes
  if (isProtectedRoute(req)) {
    await auth.protect();
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
