import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getCallerPermissions } from "@/lib/rbac";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const blob = await put(`uploads/${perms.orgId}/${Date.now()}-${file.name}`, file, {
      access: "public",
    });

    return NextResponse.json({ url: blob.url, pathname: blob.pathname });
  } catch (error: any) {
    console.error("[Upload API Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
