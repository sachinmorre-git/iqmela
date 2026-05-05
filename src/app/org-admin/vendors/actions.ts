"use server";

import { getCallerPermissions } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function addVendorAction(formData: FormData) {
  const perms = await getCallerPermissions();
  if (!perms || !perms.canManagePositions) {
    return { success: false, error: "Unauthorized" };
  }

  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;

  if (!email) return { success: false, error: "Email is required" };

  const { addManagedVendorToClient } = await import("@/lib/vendor-provisioning");
  const result = await addManagedVendorToClient({
    vendorEmail: email,
    vendorName: name || undefined,
    vendorPhone: phone || undefined,
    addedById: perms.userId,
    clientOrgId: perms.orgId,
  });

  if (result.success) {
    revalidatePath("/org-admin/vendors");
    revalidatePath("/org-admin/positions/[id]", "page");
  }

  return result;
}
