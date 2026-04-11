"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

export async function saveUserRole(role: Role) {
  try {
    console.log(`\n--- [saveUserRole] INITIATED FOR ROLE: ${role} ---`);
    const { userId } = await auth();
    console.log(`1. Authenticated UserID: ${userId}`);
    if (!userId) throw new Error("Unauthorized: No userId found");

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    console.log(`2. Fetched from Clerk API. Email resolved: ${email}`);

    if (!email) throw new Error("Processing failed: No primary email found");

    console.log(`3. Attempting Prisma User upsert for ${userId}...`);
    
    // 🛡️ THE FIX: Because you just generated brand new Clerk Keys today, 
    // Clerk created a totally new User ID for your email! 
    // We must gracefully delete your old abandoned Database record to prevent a Unique Constraint collision!
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.id !== userId) {
      console.log(`Orphaned record found! Deleting old ID ${existingUser.id} to make room for new Clerk ID ${userId}`);
      await prisma.user.delete({ where: { email } });
    }

    await prisma.user.upsert({
      where: { id: userId },
      update: { role },
      create: {
        id: userId,
        email,
        name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
        role,
      },
    });
    console.log(`4. Prisma User upsert SUCCESS.`);

    console.log(`5. Attempting specific Profile upsert...`);
    if (role === "CANDIDATE") {
      await prisma.candidateProfile.upsert({
        where: { userId },
        update: {}, 
        create: { userId },
      });
    } else if (role === "INTERVIEWER") {
      await prisma.interviewerProfile.upsert({
        where: { userId },
        update: {}, 
        create: { userId },
      });
    }
    console.log(`6. Profile upsert SUCCESS.`);

    console.log(`7. Pushing metadata to Clerk APIs...`);
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        role: role.toString().toLowerCase(),
      },
    });
    console.log(`8. Clerk metadata SUCCESS.`);

    // 🔥 THE FIX: Clerk JWT templates require dashboard configuration.
    // Instead, we set a standard Next.js HTTP cookie with the role!
    // The middleware will read this instantly!
    const { cookies } = await import("next/headers");
    (await cookies()).set("user_role", role.toString().toLowerCase(), { path: '/' });
    console.log(`9. Custom HTTP cookie injected.`);
    
    // Return success instead of redirecting so the client can reload the auth token before navigating
    return { success: true };
    
  } catch (error) {
    console.error(">>> [CRITICAL SERVER ACTION ERROR] <<<");
    console.error(error);
    throw error;
  }
}
