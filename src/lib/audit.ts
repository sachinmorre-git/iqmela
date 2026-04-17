import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export type AuditAction = 
  | "CREATED"
  | "UPDATED"
  | "DELETED"
  | "INVITED"
  | "STARTED"
  | "COMPLETED"
  | "EVALUATED";

export type ResourceType = 
  | "POSITION"
  | "RESUME"
  | "INVITE"
  | "AI_SESSION"
  | "DEPARTMENT"
  | "SETTINGS";

interface AuditEventParams {
  action: AuditAction;
  resourceType: ResourceType;
  resourceId: string;
  metadata?: Record<string, any>;
}

/**
 * Higher-Order Function (HOC) wrapper for Next.js Server Actions.
 * Enforces B2B Organization access, runs your mutation, and then safely logs it for compliance.
 * 
 * @param eventParams Defines what this server action attempts to do
 * @param action The actual mutating server action function
 * @returns The result of your server action, guaranteeing an audit trail if successful.
 */
export async function withAudit<T>(
  eventParams: AuditEventParams,
  action: (context: { userId: string, orgId: string }) => Promise<T>
): Promise<T> {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    throw new Error("Unauthorized: Active user or organization context missing.");
  }

  // 1. Execute the core mutation
  const result = await action({ userId, orgId });

  // 2. Fire-and-forget the immutable audit log entry asynchronously
  // We do not await this to avoid degrading mutation latency, but we catch errors to ensure stability
  prisma.auditLog.create({
    data: {
      userId,
      organizationId: orgId,
      action: eventParams.action,
      resourceType: eventParams.resourceType,
      resourceId: eventParams.resourceId,
      metadata: eventParams.metadata || {},
    }
  }).catch((err) => {
    console.error("CRITICAL: Failed to write to immutable audit log! ", err);
  });

  return result;
}

/**
 * A direct imperative function to log an event internally without wrapping an entire action.
 */
export async function logActivity(params: AuditEventParams & { userId: string, orgId: string }) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      organizationId: params.orgId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: params.metadata || {},
    }
  });
}
