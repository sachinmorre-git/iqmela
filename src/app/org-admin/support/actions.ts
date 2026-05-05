"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireOrgAdmin() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) throw new Error("Not authenticated");
  if (orgRole !== "org:admin") throw new Error("Unauthorized");
  return { userId, orgId };
}

export async function createSupportTicket(data: { subject: string; description: string; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; category: "BILLING" | "TECHNICAL" | "INTEGRATION" | "ONBOARDING" | "OTHER" }) {
  const { userId, orgId } = await requireOrgAdmin();
  
  // Generate a random ticket number
  const ticketNumber = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber,
      organizationId: orgId,
      createdById: userId,
      subject: data.subject,
      description: data.description,
      priority: data.priority,
      category: data.category,
      status: "OPEN",
    }
  });

  revalidatePath("/org-admin/support");
  return ticket;
}

export async function addClientTicketMessage(ticketId: string, messageText: string) {
  const { userId, orgId } = await requireOrgAdmin();
  
  // Ensure ticket belongs to org
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId }});
  if (ticket?.organizationId !== orgId) throw new Error("Unauthorized");

  await prisma.ticketMessage.create({
    data: {
      ticketId,
      senderId: userId,
      messageText,
      isInternalNote: false
    }
  });

  // If status is WAITING_ON_CLIENT, we switch it back to IN_PROGRESS since client replied
  if (ticket.status === "WAITING_ON_CLIENT") {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "IN_PROGRESS" }
    });
  }

  revalidatePath("/org-admin/support");
  revalidatePath(`/org-admin/support/${ticketId}`);
}
