"use server";

import { clerkClient, auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function deployClientSandbox(orgName: string, adminEmail: string) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      throw new Error("Unauthorized: Identity unknown.");
    }

    // Mathematical security validation: Explicitly check sysRole over the API
    const publicMeta = sessionClaims?.publicMetadata as Record<string, any>;
    const sysRole = publicMeta?.sysRole?.toString();
    const hasPermission = sysRole === "sys:superadmin" || sysRole === "sys:support";

    if (!hasPermission) {
      throw new Error("CRITICAL: Unauthorized attempt to spin up a B2B Sandbox. Action blocked.");
    }

    // Step 1: Create the Clerk Organization
    const client = await clerkClient();

    const existingOrgsResult = await client.organizations.getOrganizationList({ query: orgName });
    const existingOrgs = 'data' in existingOrgsResult ? existingOrgsResult.data : existingOrgsResult;
    
    const isDuplicate = (existingOrgs as any[]).some(
      (org) => org.name.toLowerCase() === orgName.toLowerCase()
    );

    if (isDuplicate) {
      throw new Error(`An organization named "${orgName}" already exists. Please choose a unique name.`);
    }

    const organization = await client.organizations.createOrganization({
      name: orgName,
      createdBy: userId,
    });

    // Step 1.5: Create Prisma Organization record (for planTier feature gating)
    const domain = adminEmail.includes("@") ? adminEmail.split("@")[1] : null;
    await prisma.organization.upsert({
      where: { id: organization.id },
      update: { name: orgName, planTier: "ULTRA" },
      create: {
        id: organization.id,
        name: orgName,
        domain,
        planTier: "ULTRA", // God Mode deploys get Ultra tier
      },
    });

    // Step 2: Use Postgres TeamInvite instead of Clerk's native invites 
    const token = crypto.randomBytes(32).toString("hex");

    await prisma.teamInvite.create({
      data: {
        organizationId: organization.id,
        email: adminEmail,
        roles: ["ORG_ADMIN"], 
        departmentIds: [],
        invitedById: userId,
        token: token,
        status: "SENT",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    });

    // Step 3: Dispatch our custom onboarding email
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/accept-invite?token=${token}`;
    const { emailService } = await import("@/lib/email");
    
    await emailService.sendEmail({
      to: adminEmail,
      subject: `Your IQMela Sandbox is Ready: ${orgName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Welcome to IQMela!</h2>
          <p>Your dedicated workspace for <strong>${orgName}</strong> has been successfully deployed.</p>
          <p>As the primary Organization Administrator, you have full access to manage positions, invite team members, and oversee candidate pipelines.</p>
          <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px; font-weight: bold;">Access Your Sandbox</a>
        </div>
      `,
      text: `Your workspace ${orgName} is ready. Access it here: ${inviteLink}`
    });

    // Optional: The SuperAdmin (who created the org) is still an org:admin inside the client's org.
    // They can leave it manually if needed.

    revalidatePath("/admin/clients");

    return {
      success: true,
      message: `Sandbox "${orgName}" successfully deployed. Invitation sent to ${adminEmail}.`
    };

  } catch (error: any) {
    console.error("Sandbox Deployment Failed:", error);
    return {
      success: false,
      error: error.errors?.[0]?.longMessage || error.message || "An unknown error occurred during deployment."
    };
  }
}
