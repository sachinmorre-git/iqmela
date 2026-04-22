"use server"

import { createSelfServeOrg } from "@/lib/create-org-service"

export async function handleCreateOrg(orgName: string) {
  return createSelfServeOrg({ orgName })
}
