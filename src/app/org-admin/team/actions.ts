"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { getCallerPermissions, canModifyTarget } from "@/lib/rbac";
import { clerkClient } from "@clerk/nextjs/server";

export async function sendTeamInvite(formData: FormData) {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canInvite) {
      throw new Error("Forbidden: You do not have permission to invite team members.");
    }

    const userId = perms.userId;
    const orgId = perms.orgId;

    const email = formData.get("email")?.toString();
    const name = formData.get("name")?.toString() || null;
    if (!email) throw new Error("Email is required");

    // Extract multiple roles
    const roles: string[] = [];
    formData.forEach((value, key) => {
      if (key.startsWith("role_") && value === "on") {
        roles.push(key.replace("role_", ""));
      }
    });

    if (roles.length === 0) {
      throw new Error("At least one role must be selected.");
    }
    const invalidRoles = roles.filter(r => !perms.assignableRoles.includes(r));
    if (invalidRoles.length > 0) {
      throw new Error(`Forbidden: You cannot assign the following roles: ${invalidRoles.join(', ')}`);
    }

    // Extract multiple departments
    const departmentIds: string[] = [];
    formData.forEach((value, key) => {
      if (key.startsWith("dept_") && value === "on") {
        departmentIds.push(key.replace("dept_", ""));
      }
    });

    if (perms.scopedDeptIds) {
      const invalidDepts = departmentIds.filter(id => !perms.scopedDeptIds!.includes(id));
      if (invalidDepts.length > 0) {
        throw new Error("Forbidden: You can only assign members to your own departments.");
      }
    }

    // Check if user already exists in this org (Postgres check)
    const existingDbUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingDbUser && existingDbUser.organizationId === orgId) {
      // User is in Postgres, but they might be MISSING from Clerk (legacy data issue).
      // Check Clerk and sync if needed, rather than just throwing an error.
      const client = await clerkClient();
      const clerkUsers = await client.users.getUserList({ emailAddress: [email] });
      const clerkUser = clerkUsers.data?.[0];

      if (clerkUser) {
        // Check if they're actually in the Clerk org
        try {
          const clerkRole = roles.includes("ORG_ADMIN") ? "org:admin" : "org:member";
          await client.organizations.createOrganizationMembership({
            organizationId: orgId,
            userId: clerkUser.id,
            role: clerkRole,
          });
          // Also set publicMetadata so middleware routing works
          await client.users.updateUserMetadata(clerkUser.id, {
            publicMetadata: { role: "admin" },
          });
          // Update Postgres roles in case they changed
          await prisma.user.update({
            where: { id: clerkUser.id },
            data: {
              roles: { set: roles as any[] },
              departments: { set: departmentIds.map(id => ({ id })) },
            },
          });
          revalidatePath("/org-admin/team");
          return { success: true, message: `${email} was already in the database — synced to Clerk org!` };
        } catch (syncErr: any) {
          const isAlreadyMember = syncErr.errors?.[0]?.code === "duplicate_record";
          if (isAlreadyMember) {
            return { success: false, error: "User is already a full member of this organization." };
          }
          console.warn("Clerk sync error:", syncErr);
        }
      }
      return { success: false, error: "User is already a member of this organization." };
    }

    // Check if an invite is already pending
    const existingInvite = await prisma.teamInvite.findFirst({
      where: { email, organizationId: orgId, status: { in: ["DRAFT", "SENT"] } }
    });

    if (existingInvite) {
      throw new Error("An invite for this email is already pending.");
    }

    const token = crypto.randomBytes(32).toString("hex");

    // ── PATH A: Instant Provisioning ─────────────────────────────────────────
    // If the user already has a Clerk account, add them to the org immediately.
    const client = await clerkClient();
    const clerkUsers = await client.users.getUserList({ emailAddress: [email] });
    const existingClerkUser = clerkUsers.data?.[0];

    if (existingClerkUser) {
      // 1. Add to Clerk Organization immediately
      const clerkRole = roles.includes("ORG_ADMIN") ? "org:admin" : "org:member";
      try {
        await client.organizations.createOrganizationMembership({
          organizationId: orgId,
          userId: existingClerkUser.id,
          role: clerkRole,
        });
      } catch (clerkErr: any) {
        // If already a member, that's fine — continue with Postgres sync
        const isAlreadyMember = clerkErr.errors?.[0]?.code === "duplicate_record";
        if (!isAlreadyMember) {
          console.warn("Clerk membership creation warning:", clerkErr.errors?.[0]?.message);
        }
      }

      // 2. Upsert Postgres User with org, roles, departments
      await prisma.user.upsert({
        where: { id: existingClerkUser.id },
        update: {
          organizationId: orgId,
          roles: { set: roles as any[] },
          departments: { set: departmentIds.map(id => ({ id })) },
          isDeleted: false,
          deletedAt: null,
        },
        create: {
          id: existingClerkUser.id,
          email,
          name: [existingClerkUser.firstName, existingClerkUser.lastName].filter(Boolean).join(" ") || name,
          organizationId: orgId,
          roles: roles as any[],
          departments: { connect: departmentIds.map(id => ({ id })) },
        },
      });

      // 3. Create invite record marked as ACCEPTED (for audit trail)
      await prisma.teamInvite.create({
        data: {
          organizationId: orgId,
          email,
          name,
          roles: roles as any[],
          departmentIds,
          invitedById: userId,
          token,
          status: "ACCEPTED",
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        }
      });

      // 4. Set publicMetadata.role so middleware routing works consistently.
      // All Client Org users route via /org-admin regardless of sub-role.
      try {
        await client.users.updateUserMetadata(existingClerkUser.id, {
          publicMetadata: { role: "admin" },
        });
      } catch (metaErr) {
        console.warn("Clerk metadata update warning:", metaErr);
      }

      revalidatePath("/org-admin/team");
      return { success: true, message: `${email} has been instantly added to the organization!` };
    }

    // ── PATH B: New User — Magic Link Flow ───────────────────────────────────
    // User doesn't exist in Clerk yet. Create a pending invite and send email.
    await prisma.teamInvite.create({
      data: {
        organizationId: orgId,
        email,
        name,
        roles: roles as any[],
        departmentIds,
        invitedById: userId,
        token,
        status: "SENT",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
      }
    });

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/accept-invite?token=${token}`;

    try {
      const { emailService } = await import("@/lib/email");
      await emailService.sendEmail({
        to: email,
        subject: "You've been invited to join the team",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been invited!</h2>
            <p>An administrator has invited you to join their organization on the platform.</p>
            <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">Accept Invitation</a>
          </div>
        `,
        text: `You have been invited to join the team. Accept your invitation here: ${inviteLink}`
      });
    } catch (emailErr) {
      console.warn("Email delivery failed (invite still created):", emailErr);
    }

    revalidatePath("/org-admin/team");
    
    return { success: true, message: `Invite sent to ${email} successfully!` };
  } catch (error: any) {
    console.error("Team Invite Error:", error);
    return { success: false, error: error.message || "Failed to send invite." };
  }
}

export async function updateMember(targetUserId: string, roles: string[], deptIds: string[]) {
  try {
    const perms = await getCallerPermissions();
    if (!perms || (!perms.isOrgAdmin && !perms.isDeptAdmin)) {
      throw new Error("Forbidden");
    }
    const orgId = perms.orgId;

    // ── Self-edit prevention ──
    if (targetUserId === perms.userId) {
      throw new Error("You cannot modify your own roles.");
    }

    // Verify caller can assign these roles
    const invalidRoles = roles.filter(r => !perms.assignableRoles.includes(r));
    if (invalidRoles.length > 0) {
      throw new Error(`Forbidden: You cannot assign the following roles: ${invalidRoles.join(', ')}`);
    }

    // Verify caller has access to these target departments
    if (perms.scopedDeptIds) {
      const invalidDepts = deptIds.filter(id => !perms.scopedDeptIds!.includes(id));
      if (invalidDepts.length > 0) {
        throw new Error("Forbidden: You can only modify your own departments.");
      }
    }

    // Verify target belongs to the same org and scoped department
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { organizationId: true, roles: true, departments: { select: { id: true } } }
    });
    if (!target || target.organizationId !== orgId) {
      throw new Error("User not found in this organization");
    }

    // ── Rank guard: cannot modify someone of equal or higher rank ──
    if (!canModifyTarget(perms.roles, target.roles as string[], perms.userId, targetUserId)) {
      throw new Error("Forbidden: You cannot modify a user with equal or higher privileges.");
    }
    
    // Scoped restriction: you can only update users that are currently in at least one of your departments 
    if (perms.scopedDeptIds) {
      const targetDeptIds = target.departments.map(d => d.id);
      const hasOverlap = targetDeptIds.some(id => perms.scopedDeptIds!.includes(id));
      // allow if the target has no departments, meaning they're unassigned
      if (targetDeptIds.length > 0 && !hasOverlap) {
         throw new Error("Forbidden: User is not in your departments.");
      }
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        roles: { set: roles as any[] },
        departments: {
          set: deptIds.map((id) => ({ id })),
        },
      },
    });

    // ── Audit log — RBAC change trail ──────────────────────────────
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: perms.userId,
        action: "MEMBER_ROLE_CHANGED",
        resourceType: "User",
        resourceId: targetUserId,
        metadata: {
          previousRoles: target.roles,
          newRoles: roles,
          departments: deptIds,
        },
      },
    }).catch((err) =>
      console.error("[UpdateMember] Audit log write failed:", err)
    );

    revalidatePath("/org-admin/team");
    return { success: true };
  } catch (error: any) {
    console.error("Update Member Error:", error);
    return { success: false, error: error.message };
  }
}

export async function removeMember(targetUserId: string) {
  try {
    const perms = await getCallerPermissions();
    if (!perms || (!perms.isOrgAdmin && !perms.isDeptAdmin)) {
      throw new Error("Forbidden");
    }
    const userId = perms.userId;
    const orgId = perms.orgId;

    // Prevent self-removal
    if (targetUserId === userId) throw new Error("You cannot remove yourself.");

    // Verify target belongs to the same org
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { organizationId: true, roles: true, departments: { select: { id: true } } }
    });
    if (!target || target.organizationId !== orgId) {
      throw new Error("User not found in this organization");
    }

    // ── Rank guard: cannot remove someone of equal or higher rank ──
    if (!canModifyTarget(perms.roles, target.roles as string[], perms.userId, targetUserId)) {
      throw new Error("Forbidden: You cannot remove a user with equal or higher privileges.");
    }
    
    if (perms.scopedDeptIds) {
      const targetDeptIds = target.departments.map(d => d.id);
      const hasOverlap = targetDeptIds.some(id => perms.scopedDeptIds!.includes(id));
      if (targetDeptIds.length > 0 && !hasOverlap) {
         throw new Error("Forbidden: User is not in your departments.");
      }
    }

    // Soft-delete: clear org association and mark as deleted
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        organizationId: null,
        roles: { set: [] },
        departments: { set: [] },
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    // Also remove from Clerk org
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      await client.organizations.deleteOrganizationMembership({
        organizationId: orgId,
        userId: targetUserId,
      });
    } catch (clerkErr) {
      console.warn("Clerk membership removal error (may already be removed):", clerkErr);
    }

    revalidatePath("/org-admin/team");

    // ── Audit log — access revocation trail ────────────────────────
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId,
        action: "MEMBER_REMOVED",
        resourceType: "User",
        resourceId: targetUserId,
        metadata: {
          removedRoles: target.roles,
        },
      },
    }).catch((err) =>
      console.error("[RemoveMember] Audit log write failed:", err)
    );

    return { success: true };
  } catch (error: any) {
    console.error("Remove Member Error:", error);
    return { success: false, error: error.message };
  }
}

export async function revokeInvite(inviteId: string) {
  try {
    const perms = await getCallerPermissions();
    if (!perms || (!perms.isOrgAdmin && !perms.isDeptAdmin)) {
      throw new Error("Forbidden");
    }
    const orgId = perms.orgId;

    const invite = await prisma.teamInvite.findUnique({
      where: { id: inviteId }
    });

    if (!invite || invite.organizationId !== orgId) {
      throw new Error("Invite not found in this organization");
    }

    if (invite.status !== "SENT" && invite.status !== "DRAFT") {
      throw new Error("Cannot revoke an invite that is already accepted or revoked");
    }

    await prisma.teamInvite.delete({
      where: { id: inviteId }
    });

    revalidatePath("/org-admin/team");
    return { success: true };
  } catch (error: any) {
    console.error("Revoke Invite Error:", error);
    return { success: false, error: error.message };
  }
}
