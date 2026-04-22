"use server";

import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function createDepartment(formData: FormData) {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canCreateDepartment) {
      throw new Error("Forbidden: Only Organization Admins can create departments");
    }

    const name = formData.get("name")?.toString().trim();
    if (!name) throw new Error("Department name is required");

    // Check if department inherently exists for this org
    const existing = await prisma.department.findFirst({
      where: { organizationId: perms.orgId, name: { equals: name, mode: 'insensitive' } }
    });

    if (existing) throw new Error(`Department "${name}" already exists`);

    await prisma.department.create({
      data: {
        name,
        organizationId: perms.orgId,
      }
    });

    revalidatePath("/org-admin/departments");
    return { success: true };
  } catch (error: any) {
    console.error("Create Department Error:", error);
    return { success: false, error: error.message || "Failed to create department" };
  }
}

export async function deleteDepartment(departmentId: string) {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canCreateDepartment) {
      throw new Error("Forbidden: Only Organization Admins can manage departments");
    }

    // Explicitly check members assigned to this department
    const members = await prisma.user.count({
      where: {
        organizationId: perms.orgId,
        departments: {
          some: { id: departmentId }
        }
      }
    });

    if (members > 0) {
      throw new Error(`Cannot delete department: ${members} members are still assigned to it. Remove them from the department first.`);
    }

    await prisma.department.delete({
      where: {
        id: departmentId,
        organizationId: perms.orgId, // security check
      }
    });

    revalidatePath("/org-admin/departments");
    return { success: true };
  } catch (error: any) {
    console.error("Delete Department Error:", error);
    return { success: false, error: error.message || "Failed to delete department" };
  }
}
