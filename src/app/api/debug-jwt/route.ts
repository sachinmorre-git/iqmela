import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  const { sessionClaims, userId, orgId } = await auth();
  return NextResponse.json({ sessionClaims, userId, orgId });
}
