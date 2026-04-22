import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { TimeSlot } from "@/lib/poll-utils";

// ── GET /api/poll/[token]/stream ──────────────────────────────────────────────
// Server-Sent Events endpoint for real-time grid updates.
// The poll page subscribes to this and receives "grid-update" events
// whenever any participant's slot data changes (auto-polled by cron
// and also triggered after a POST to /slots).
//
// Each event payload: JSON string of all participants' current slots.
// Client reconnects automatically on drop (EventSource standard behaviour).

export const dynamic = "force-dynamic"; // Prevent Next.js caching

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Validate the token belongs to a real response
  const response = await prisma.availabilityResponse.findUnique({
    where: { token },
    select: { pollId: true, id: true },
  });

  if (!response) {
    return new Response("Not found", { status: 404 });
  }

  const pollId = response.pollId;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Send initial heartbeat
      send({ type: "connected" });

      // Poll the DB every 5 seconds and push updates
      // (SSE keeps connection alive; client handles reconnect)
      let prevHash = "";
      const interval = setInterval(async () => {
        try {
          const allResponses = await prisma.availabilityResponse.findMany({
            where: { pollId },
            select: {
              userId: true,
              token: true,
              slotsJson: true,
              submittedAt: true,
            },
          });

          // Only push if anything changed (compare slot counts as a quick hash)
          const hash = allResponses
            .map((r) =>
              `${r.userId}:${r.submittedAt?.getTime() ?? 0}:${
                r.slotsJson ? JSON.stringify(r.slotsJson).length : 0
              }`
            )
            .join("|");

          if (hash !== prevHash) {
            prevHash = hash;

            const userIds = allResponses.map((r) => r.userId);
            const users = await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, email: true },
            });

            const participants = allResponses.map((r) => {
              const user = users.find((u) => u.id === r.userId);
              return {
                userId: r.userId,
                isMe: r.token === token,
                name: user?.name || user?.email || "Panelist",
                slots: (r.slotsJson as unknown as TimeSlot[]) || [],
                hasSubmitted: r.submittedAt != null,
              };
            });

            // Also check if poll is now READY (all responded)
            const poll = await prisma.availabilityPoll.findUnique({
              where: { id: pollId },
              select: { status: true, commonSlotsJson: true },
            });

            send({
              type: "grid-update",
              participants,
              pollStatus: poll?.status,
              commonSlots: (poll?.commonSlotsJson as unknown as TimeSlot[]) || [],
            });
          }

          // Heartbeat keep-alive comment
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 5000); // Poll every 5 seconds

      // Clean up when client disconnects
      _req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
}
