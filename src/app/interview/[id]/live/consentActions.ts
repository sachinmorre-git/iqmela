"use server";

import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";

/**
 * Records that a participant has given informed consent to being recorded.
 * Called immediately before the token fetch on join.
 */
export async function saveConsentAction(interviewId: string): Promise<{ success: boolean }> {
  try {
    const perms = await getCallerPermissions();
    if (!perms) throw new Error("Unauthorized");

    // Only record consent for the candidate (they're the one being evaluated)
    await prisma.interview.updateMany({
      where: { id: interviewId },
      data: {
        consentGiven: true,
        consentGivenAt: new Date(),
      },
    });

    return { success: true };
  } catch (err) {
    console.error("[consentAction] error:", err);
    return { success: false };
  }
}
