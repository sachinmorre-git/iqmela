import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";

const isProtectedRoute = createRouteMatcher([
  '/candidate(.*)',
  '/interviewer(.*)',
  '/org-admin(.*)',
  '/admin(.*)',
  '/create-org',
]);

// Routes that are always accessible (no agreement gate)
const isLegalRoute  = createRouteMatcher(['/legal(.*)']);
const isApiRoute    = createRouteMatcher(['/api(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const { userId, orgId, sessionClaims } = await auth();

  if (userId) {
    const meta       = (sessionClaims?.publicMetadata as Record<string, any>) ?? {};
    const orgMeta    = (sessionClaims?.orgMetadata    as Record<string, any>) ?? {};
    const isSystemStaff = meta?.sysRole?.toString().startsWith('sys:');
    const path          = req.nextUrl.pathname;

    // ── ① Agreement Gate: User ToS ────────────────────────────────────────
    // Skip for: legal pages, API routes, system staff, already on accept page
    const tosVersion = meta?.tosVersion as string | undefined;
    const needsToS   = !isSystemStaff
      && !isLegalRoute(req)
      && !isApiRoute(req)
      && isProtectedRoute(req)
      && tosVersion !== LEGAL_VERSIONS.PLATFORM_TOS;

    if (needsToS) {
      const next = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(new URL(`/legal/accept-user?next=${next}`, req.url));
    }

    // ── ② Agreement Gate: Org MSA ─────────────────────────────────────────
    // Only for org-admin routes, and only if user is in an org
    if (orgId && path.startsWith('/org-admin') && !isLegalRoute(req) && !isApiRoute(req)) {
      const msaVersion = orgMeta?.msaVersion as string | undefined;
      if (msaVersion !== LEGAL_VERSIONS.ORG_MSA) {
        const next = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search);
        return NextResponse.redirect(new URL(`/legal/accept-org?next=${next}`, req.url));
      }
    }

    // 0. Enforce B2B Organization boundary
    if (path.startsWith('/org-admin') && !orgId) {
      return NextResponse.redirect(new URL('/select-org', req.url));
    }

    // 0.B Enforce B2B Global Admin isolation boundary
    if (path.startsWith('/admin')) {
      if (!isSystemStaff) {
        return NextResponse.redirect(new URL('/select-role', req.url));
      }
    }

    let res: NextResponse | undefined;

    // Clerk's session token is the authoritative source of truth.
    const tokenRole = meta?.role as string | undefined;

    // Normalize: Prisma enum "admin" → URL segment "org-admin"
    const normalizedTokenRole = tokenRole === "admin" ? "org-admin" : tokenRole;

    const cookieRole = req.cookies.get("user_role")?.value;

    let activeRole = normalizedTokenRole || cookieRole;

    // 🔥 Fix stale cookie
    if (cookieRole && normalizedTokenRole !== cookieRole) {
      res = NextResponse.next();
      if (normalizedTokenRole) {
        res.cookies.set("user_role", normalizedTokenRole, { path: "/" });
        activeRole = normalizedTokenRole;
      } else {
        res.cookies.delete("user_role");
        activeRole = undefined;
      }
    }

    // 0.C Methodical IQMela Staff Routing
    if (isSystemStaff) {
       if (path === '/' || path === '/select-role' || path.startsWith('/candidate')) {
           return NextResponse.redirect(new URL('/admin/dashboard', req.url));
       }
    }

    // 1. If visiting /select-role but already has a role, redirect to their dashboard
    if (path === '/select-role' && activeRole) {
      if (!req.nextUrl.searchParams.has('force')) {
        return NextResponse.redirect(new URL(`/${activeRole}/dashboard`, req.url));
      }
    }

    // 2. If hitting a protected route with no role, send to select-role.
    if (isProtectedRoute(req) && !activeRole && !isSystemStaff) {
      const isOrgRouteWithActiveOrg = path.startsWith('/org-admin') && !!orgId;
      if (!isOrgRouteWithActiveOrg) {
        return NextResponse.redirect(new URL('/select-role', req.url));
      }
    }

    // 3. Apply global auth protection to dashboard routes
    if (isProtectedRoute(req)) {
      await auth.protect();
    }

    if (res) return res;
  }

  // Fallback for non-authenticated states or routes not intercepted above
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

