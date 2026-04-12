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

  // Handle post-login redirection based on assigned roles
  if (userId) {
    // Rely primarily on Clerk's cryptographically secure session claims.
    // If the token is freshly issued, it contains the correct role natively!
    // We fall back to the generic cookie ONLY if necessary (for rapid client-side transitions before tokens refresh)
    const tokenRole = sessionClaims?.publicMetadata?.role as string | undefined;
    const cookieRole = req.cookies.get("user_role")?.value;
    
    // Normalize mapping (e.g. "ADMIN" in prisma is "org-admin" in URL)
    const activeRole = tokenRole === "admin" ? "org-admin" : (tokenRole || cookieRole);

    // 1. If user visits /select-role but already has an ACTIVE role tied EXACTLY to this identity, redirect them
    if (req.nextUrl.pathname === '/select-role' && activeRole) {
      const urlSegment = activeRole.toLowerCase() === "admin" ? "org-admin" : activeRole.toLowerCase();
      // Allow overriding if they append ?force=true
      if (!req.nextUrl.searchParams.has('force')) {
        return NextResponse.redirect(new URL(`/${urlSegment}/dashboard`, req.url));
      }
    }

    // 2. If user tries to access a protected route but has NO role, force them to select one
    if (isProtectedRoute(req) && !activeRole) {
      return NextResponse.redirect(new URL('/select-role', req.url));
    }
  }

  // Enforce global auth protection
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
