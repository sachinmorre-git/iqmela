"use server";

import { clerkClient, auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { emailService } from "@/lib/email";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DispatchResult {
  success: boolean;
  vendorOrgId?: string;
  vendorOrgName?: string;
  wasAutoProvisioned?: boolean;
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract domain from an email address.
 * "sachin@staffco.com" → "staffco.com"
 */
function extractDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() || "";
}

/**
 * Generate an org name from a domain.
 * "staffco.com" → "StaffCo"
 * "abc-consulting.io" → "Abc Consulting"
 */
function domainToOrgName(domain: string): string {
  const base = domain.split(".")[0]; // "staffco" or "abc-consulting"
  return base
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ── Core Dispatch Function ───────────────────────────────────────────────────

/**
 * Dispatch a position to a vendor agency by email.
 *
 * Flow:
 * 1. Extract domain from vendor email
 * 2. Check if an IQMela Organization exists for that domain
 * 3. If NO → auto-create Clerk org + Prisma Organization with VENDOR_FREE plan
 * 4. Create PositionVendor bridge record (idempotent)
 * 5. Return the vendor org details
 *
 * This function is IDEMPOTENT — dispatching the same position to the same
 * vendor org twice will not create duplicates.
 */
export async function dispatchPositionToVendor(params: {
  positionId: string;
  vendorEmail: string;
  dispatchedById: string;
  clientOrgId: string;
}): Promise<DispatchResult> {
  const { positionId, vendorEmail, dispatchedById, clientOrgId } = params;

  try {
    // ── Validate inputs ──────────────────────────────────────────────────
    const email = vendorEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return { success: false, error: "Invalid email address." };
    }

    const domain = extractDomain(email);
    if (!domain) {
      return { success: false, error: "Could not extract domain from email." };
    }

    // ── Verify position belongs to caller's org ──────────────────────────
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      select: { id: true, organizationId: true, title: true },
    });

    if (!position || position.organizationId !== clientOrgId) {
      return { success: false, error: "Position not found or unauthorized." };
    }

    // ── Step 1: Look up existing vendor org by domain ────────────────────
    let vendorOrg = await prisma.organization.findFirst({
      where: { domain },
    });

    let wasAutoProvisioned = false;

    // ── Step 2: Auto-provision if vendor org doesn't exist ───────────────
    if (!vendorOrg) {
      const orgName = domainToOrgName(domain);
      const client = await clerkClient();

      // Check for duplicate Clerk orgs
      const existingOrgsResult = await client.organizations.getOrganizationList({
        query: orgName,
      });
      const existingOrgs =
        "data" in existingOrgsResult
          ? existingOrgsResult.data
          : existingOrgsResult;
      const isDuplicate = (existingOrgs as any[]).some(
        (org) => org.name.toLowerCase() === orgName.toLowerCase()
      );

      let clerkOrgId: string;

      if (isDuplicate) {
        // Clerk org exists but Prisma record doesn't — reconcile
        const existing = (existingOrgs as any[]).find(
          (org) => org.name.toLowerCase() === orgName.toLowerCase()
        );
        clerkOrgId = existing.id;
      } else {
        // Create new Clerk organization
        const newClerkOrg = await client.organizations.createOrganization({
          name: orgName,
          createdBy: dispatchedById, // The client admin who dispatched
        });
        clerkOrgId = newClerkOrg.id;
      }

      // Create Prisma Organization record
      vendorOrg = await prisma.organization.create({
        data: {
          id: clerkOrgId,
          name: domainToOrgName(domain),
          domain,
          planTier: "VENDOR_FREE",
        },
      });

      wasAutoProvisioned = true;

      console.log(
        `[vendor-provisioning] Auto-provisioned vendor org "${vendorOrg.name}" (${vendorOrg.id}) for domain "${domain}"`
      );
    }

    // ── Guard: Vendor org must not be the SAME as the client org ──────────
    if (vendorOrg.id === clientOrgId) {
      return {
        success: false,
        error: "Cannot dispatch a position to your own organization.",
      };
    }

    // ── Step 3: Create PositionVendor bridge (idempotent) ────────────────
    await prisma.positionVendor.upsert({
      where: {
        positionId_vendorOrgId: { positionId, vendorOrgId: vendorOrg.id },
      },
      update: { status: "ACTIVE" }, // Re-activate if previously revoked
      create: {
        positionId,
        vendorOrgId: vendorOrg.id,
        dispatchedById,
        status: "ACTIVE",
      },
    });

    // ── Step 3.5: Auto-add to explicit Vendor Directory ─────────────────
    await prisma.clientVendorRelation.upsert({
      where: { clientOrgId_vendorOrgId: { clientOrgId, vendorOrgId: vendorOrg.id } },
      update: { contactEmail: email },
      create: {
        clientOrgId,
        vendorOrgId: vendorOrg.id,
        contactEmail: email,
      }
    });

    // ── Step 4: Ensure the vendor user exists in the vendor org ───────────
    // Check if the specific user is already a member of the vendor org
    const client = await clerkClient();
    try {
      // Look up user by email in Clerk
      const users = await client.users.getUserList({
        emailAddress: [email],
      });

      if (users.data && users.data.length > 0) {
        const vendorUser = users.data[0];

        // Try to add them to the vendor org if not already a member
        try {
          await client.organizations.createOrganizationMembership({
            organizationId: vendorOrg.id,
            userId: vendorUser.id,
            role: "org:admin", // First person gets admin of their vendor org
          });

          // Upsert Prisma user
          await prisma.user.upsert({
            where: { id: vendorUser.id },
            update: { organizationId: vendorOrg.id },
            create: {
              id: vendorUser.id,
              email,
              name:
                `${vendorUser.firstName || ""} ${vendorUser.lastName || ""}`.trim() ||
                null,
              roles: ["ORG_ADMIN"],
              organizationId: vendorOrg.id,
            },
          });
        } catch {
          // Already a member — that's fine
        }
      }
      // If user doesn't exist in Clerk, they'll sign up and the org will be
      // available via /select-org when they create an account with that domain
    } catch {
      // Non-critical — user membership is best-effort at dispatch time
      console.log(
        `[vendor-provisioning] Could not add ${email} to vendor org — they'll join on first login`
      );
    }

    // ── Step 5: Log the dispatch ─────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        organizationId: clientOrgId,
        userId: dispatchedById,
        action: "VENDOR_DISPATCH",
        resourceType: "Position",
        resourceId: positionId,
        metadata: {
          vendorEmail: email,
          vendorOrgId: vendorOrg.id,
          vendorOrgName: vendorOrg.name,
          positionTitle: position.title,
          wasAutoProvisioned,
        },
      },
    });

    // ── Step 6: Send transactional emails (non-blocking) ─────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iqmela.com";
    const dropzoneUrl = `${appUrl}/vendor/positions/${positionId}`;

    // Get client org name for email context
    const clientOrg = await prisma.organization.findUnique({
      where: { id: clientOrgId },
      select: { name: true },
    });
    const clientOrgName = clientOrg?.name || "A client organization";

    // Get dispatching admin's email for confirmation
    const dispatchingAdmin = await prisma.user.findUnique({
      where: { id: dispatchedById },
      select: { email: true, name: true },
    });

    // Fire both emails in parallel — never block the dispatch
    await Promise.allSettled([
      // Email 1: Notify the VENDOR
      emailService.sendGenericEmail({
        to: email,
        subject: `New Position Dispatched: ${position.title}`,
        previewText: `${clientOrgName} has shared a position with your agency`,
        heading: `📋 New Position: ${position.title}`,
        body: [
          `<strong>${clientOrgName}</strong> has dispatched a position to your agency.`,
          ``,
          `<strong>Position:</strong> ${position.title}`,
          `<strong>Organization:</strong> ${clientOrgName}`,
          ``,
          `You can start uploading candidate resumes immediately using the secure dropzone link below.`,
          ``,
          `If you don't have an IQMela account yet, you'll be prompted to create one with your work email.`,
        ].join("\n"),
        ctaLabel: "Open Dropzone & Upload Candidates",
        ctaUrl: dropzoneUrl,
      }),

      // Email 2: Confirm dispatch to the CLIENT ADMIN
      ...(dispatchingAdmin?.email
        ? [
            emailService.sendGenericEmail({
              to: dispatchingAdmin.email,
              subject: `✓ Vendor Dispatched: ${vendorOrg.name} → ${position.title}`,
              heading: `Vendor Dispatch Confirmed`,
              body: [
                `Your dispatch to <strong>${vendorOrg.name}</strong> for <strong>${position.title}</strong> was successful.`,
                ``,
                `<strong>Vendor:</strong> ${vendorOrg.name} (${email})`,
                `<strong>Status:</strong> Active — vendor can now upload candidates`,
                wasAutoProvisioned
                  ? `<strong>Note:</strong> This vendor was auto-provisioned (new to IQMela).`
                  : ``,
                ``,
                `You can revoke access or copy the dropzone link from the position page.`,
              ]
                .filter(Boolean)
                .join("\n"),
              ctaLabel: "View Position",
              ctaUrl: `${appUrl}/org-admin/positions/${positionId}`,
            }),
          ]
        : []),
    ]);

    revalidatePath(`/org-admin/positions/${positionId}`);

    return {
      success: true,
      vendorOrgId: vendorOrg.id,
      vendorOrgName: vendorOrg.name,
      wasAutoProvisioned,
    };
  } catch (error) {
    console.error("[vendor-provisioning] Dispatch failed:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unknown error occurred during vendor dispatch.",
    };
  }
}

// ── Revoke Vendor Access ─────────────────────────────────────────────────────

/**
 * Revoke a vendor's access to a specific position.
 * The vendor org and its data remain intact — only the dispatch is deactivated.
 */
export async function revokeVendorDispatch(params: {
  positionId: string;
  vendorOrgId: string;
  revokedById: string;
  clientOrgId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { positionId, vendorOrgId, revokedById, clientOrgId } = params;

  try {
    // Verify position belongs to caller's org
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      select: { organizationId: true, title: true },
    });

    if (!position || position.organizationId !== clientOrgId) {
      return { success: false, error: "Position not found or unauthorized." };
    }

    await prisma.positionVendor.update({
      where: {
        positionId_vendorOrgId: { positionId, vendorOrgId },
      },
      data: { status: "REVOKED" },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: clientOrgId,
        userId: revokedById,
        action: "VENDOR_REVOKE",
        resourceType: "Position",
        resourceId: positionId,
        metadata: {
          vendorOrgId,
          positionTitle: position.title,
        },
      },
    });

    revalidatePath(`/org-admin/positions/${positionId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to revoke vendor.",
    };
  }
}

// ── Fetch dispatched vendors for a position ──────────────────────────────────

/**
 * Get all vendor orgs dispatched for a given position,
 * with resume counts per vendor.
 */
export async function getPositionVendorDispatches(
  positionId: string,
  clientOrgId: string
) {
  const dispatches = await prisma.positionVendor.findMany({
    where: { positionId },
    include: {
      vendorOrg: {
        select: { id: true, name: true, domain: true, planTier: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get resume counts per vendor org
  const resumeCounts = await prisma.resume.groupBy({
    by: ["vendorOrgId"],
    where: {
      positionId,
      vendorOrgId: { not: null },
    },
    _count: { id: true },
  });

  const countMap = new Map(
    resumeCounts.map((rc) => [rc.vendorOrgId, rc._count.id])
  );

  return dispatches.map((d) => ({
    id: d.id,
    vendorOrgId: d.vendorOrgId,
    vendorOrgName: d.vendorOrg.name,
    vendorDomain: d.vendorOrg.domain,
    status: d.status,
    resumeCount: countMap.get(d.vendorOrgId) || 0,
    dispatchedAt: d.createdAt,
  }));
}

/**
 * Get all past vendor orgs this client org has dispatched to across any position.
 */
export async function getClientPastVendors(clientOrgId: string) {
  const relations = await prisma.clientVendorRelation.findMany({
    where: { clientOrgId },
    include: { vendorOrg: true },
    orderBy: { createdAt: "desc" }
  });

  return relations.map((r) => ({
    id: r.vendorOrg.id,
    name: r.vendorOrg.name,
    domain: r.vendorOrg.domain,
    email: r.contactEmail,
    phone: r.contactPhone || "—"
  }));
}

/**
 * Onboards a new vendor to the client's explicit address book.
 */
export async function addManagedVendorToClient(params: {
  vendorEmail: string;
  vendorName?: string;
  vendorPhone?: string;
  addedById: string;
  clientOrgId: string;
}): Promise<{ success: boolean; vendorOrgId?: string; vendorOrgName?: string; wasAutoProvisioned?: boolean; error?: string }> {
  const { vendorEmail, vendorName, vendorPhone, addedById, clientOrgId } = params;
  try {
    const email = vendorEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return { success: false, error: "Invalid email address." };
    const domain = extractDomain(email);
    if (!domain) return { success: false, error: "Could not extract domain from email." };

    let vendorOrg = await prisma.organization.findFirst({ where: { domain } });
    let wasAutoProvisioned = false;

    if (!vendorOrg) {
      const orgName = vendorName || domainToOrgName(domain);
      const client = await clerkClient();
      const existingOrgsResult = await client.organizations.getOrganizationList({ query: orgName });
      const existingOrgs = "data" in existingOrgsResult ? existingOrgsResult.data : existingOrgsResult;
      const existing = (existingOrgs as any[]).find(org => org.name.toLowerCase() === orgName.toLowerCase());
      
      let clerkOrgId: string;
      if (existing) clerkOrgId = existing.id;
      else {
        const newClerkOrg = await client.organizations.createOrganization({ name: orgName, createdBy: addedById });
        clerkOrgId = newClerkOrg.id;
      }
      vendorOrg = await prisma.organization.create({
        data: { id: clerkOrgId, name: domainToOrgName(domain), domain, planTier: "VENDOR_FREE" },
      });
      wasAutoProvisioned = true;
    }

    if (vendorOrg.id === clientOrgId) return { success: false, error: "Cannot add your own organization." };

    await prisma.clientVendorRelation.upsert({
      where: { clientOrgId_vendorOrgId: { clientOrgId, vendorOrgId: vendorOrg.id } },
      update: {
        contactEmail: email,
        ...(vendorName && { contactName: vendorName }),
        ...(vendorPhone && { contactPhone: vendorPhone })
      },
      create: {
        clientOrgId,
        vendorOrgId: vendorOrg.id,
        contactName: vendorName || null,
        contactEmail: email,
        contactPhone: vendorPhone || null
      }
    });

    return { success: true, vendorOrgId: vendorOrg.id, vendorOrgName: vendorOrg.name, wasAutoProvisioned };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add vendor." };
  }
}
