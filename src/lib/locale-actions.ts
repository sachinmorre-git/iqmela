"use server";

/**
 * Server action to save the auto-detected browser timezone to the user's profile.
 * Called once on first login/mount when no timezone is stored yet.
 */

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function saveDetectedTimezone(timezone: string): Promise<{ success: boolean }> {
  const { userId, orgId } = await auth();
  if (!userId) return { success: false };

  // Validate timezone string (must be valid IANA timezone)
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    console.warn(`[saveDetectedTimezone] Invalid timezone: ${timezone}`);
    return { success: false };
  }

  // Try to update the user's profile timezone (whichever profile type exists)
  // We update all three profile types in parallel — only the one that exists will succeed
  const updates = await Promise.allSettled([
    prisma.candidateProfile.updateMany({
      where: { userId, timezone: null },
      data: { timezone },
    }),
    prisma.interviewerProfile.updateMany({
      where: { userId, timezone: null },
      data: { timezone },
    }),
    prisma.orgAdminProfile.updateMany({
      where: { userId, timezone: null },
      data: { timezone },
    }),
  ]);

  const anyUpdated = updates.some(
    (r) => r.status === "fulfilled" && (r.value as any)?.count > 0
  );

  if (anyUpdated) {
    console.log(`[saveDetectedTimezone] Auto-set timezone to ${timezone} for user ${userId}`);
  }

  // Also update the org default if it's null (first user to log in sets it)
  if (orgId) {
    try {
      await prisma.organization.updateMany({
        where: { id: orgId, defaultTimezone: null },
        data: { defaultTimezone: timezone },
      });
    } catch {
      // Org may not exist yet — non-critical
    }
  }

  return { success: true };
}
