import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  // Capture the raw body payload for Svix verification
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  // Require webhook signature validation
  const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Webhook] EMAIL_WEBHOOK_SECRET is missing. Cannot verify payloads.");
    // Fail closed if misconfigured in production
    return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
  }

  // Verify authenticity
  let event: any;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(payload, headers);
  } catch (err: any) {
    console.error("[Webhook] Verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Webhook is authentic. Parse the event.
  const { type, data } = event;
  console.log(`[Webhook] Processing ${type} event for email to ${data.to[0]}`);

  // We embedded the invite_id into the tags array out of the email service
  const tags = data.tags || [];
  const inviteTag = tags.find((t: any) => t.name === "invite_id");
  const inviteId = inviteTag?.value;

  if (!inviteId) {
    console.warn(`[Webhook] Event ${type} missing 'invite_id' tag, cannot track in DB. Ignoring.`);
    return NextResponse.json({ success: true, ignored: true });
  }

  try {
    // Map Resend events directly into our new database tracking column
    let deliveryStatusUpdate = "";
    
    switch (type) {
      case "email.delivered":
        deliveryStatusUpdate = "DELIVERED";
        break;
      case "email.bounced":
        deliveryStatusUpdate = "BOUNCED";
        // If bounced, we optionally revert Invite status so the recruiter knows to fix it
        await prisma.interviewInvite.update({
          where: { id: inviteId },
          data: { status: "DRAFT" }
        });
        break;
      case "email.complained": // marked as spam
        deliveryStatusUpdate = "COMPLAINED";
        break;
      case "email.opened":
      case "email.clicked":
        // Depending on privacy terms, we can track these later. 
        // For now, we only care about core delivery issues.
        deliveryStatusUpdate = type.split(".")[1].toUpperCase();
        break;
      default:
        // Ignore unhandled events safely
        return NextResponse.json({ success: true, ignored: true });
    }

    if (deliveryStatusUpdate) {
      await prisma.interviewInvite.update({
        where: { id: inviteId },
        data: { lastDeliveryStatus: deliveryStatusUpdate }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhook] Database update failed:", error);
    // Return 200 anyway so Resend doesn't keep retrying infinitely if the DB is down or row is missing
    return NextResponse.json({ success: false, error: "DB Failure" }, { status: 200 });
  }
}
