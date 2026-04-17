import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Generates a cryptographically secure, one-time URL token
 * and attaches it to an AiInterviewSession for zero-auth candidate access.
 */
export async function generateMagicLink(sessionId: string): Promise<string> {
  // Generate 64 bytes of random data and hash it for a URL-safe token
  const rawToken = crypto.randomBytes(48).toString('base64url');
  
  // Attach the token directly into the Session. 
  // It is Unique in the DB.
  await prisma.aiInterviewSession.update({
    where: { id: sessionId },
    data: { magicLinkToken: rawToken }
  });

  // Construct the URL to email the candidate.
  // We use the absolute path /interview/magic/[token] to bypass Clerk inside middleware.ts
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl}/interview/magic/${rawToken}`;
}

/**
 * Burns the token instantly rendering it invalid for replay attacks.
 * Should be called right after the WebRTC/Orb stream finishes.
 */
export async function burnMagicLink(token: string): Promise<void> {
  await prisma.aiInterviewSession.update({
    where: { magicLinkToken: token },
    data: { 
      status: "COMPLETED",
      completedAt: new Date()
      // We don't delete the token so audit logs match,
      // but the Lobby strictly blocks 'COMPLETED' status
    }
  });
}
