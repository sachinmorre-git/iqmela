"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireSysAdmin() {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Not authenticated");
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) throw new Error("Unauthorized");
  return { userId, sysRole };
}

export async function updateTicketStatus(ticketId: string, status: "OPEN" | "IN_PROGRESS" | "WAITING_ON_CLIENT" | "RESOLVED" | "CLOSED") {
  await requireSysAdmin();
  
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { 
      status,
      resolvedAt: (status === "RESOLVED" || status === "CLOSED") ? new Date() : null 
    }
  });

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
}

export async function addTicketMessage(ticketId: string, messageText: string, isInternalNote: boolean) {
  const { userId } = await requireSysAdmin();
  
  await prisma.ticketMessage.create({
    data: {
      ticketId,
      senderId: userId,
      messageText,
      isInternalNote
    }
  });

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
}
