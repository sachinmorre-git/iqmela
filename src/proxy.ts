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
    // Read the explicit custom cookie we just set! This completely bypasses the need to manually configure Clerk JWT templates.
    const role = req.cookies.get("user_role")?.value;

    // 1. If user visits /select-role but already has a role, redirect to their role-specific dashboard
    if (req.nextUrl.pathname === '/select-role' && role) {
      return NextResponse.redirect(new URL(`/${role.toLowerCase()}/dashboard`, req.url));
    }

    // 2. If user tries to access a protected dashboard route but has NO role, force them to select one
    if (isProtectedRoute(req) && !role) {
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
