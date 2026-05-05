"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  addBlockedCountry,
  removeBlockedCountry,
  getBlockedCountries,
  getAllGeoBlockHistory,
  forceRefreshGeoBlocks,
  COUNTRY_LIST,
} from "@/lib/geo-block";

async function requireSysAdmin() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) redirect("/select-role");
  return { userId };
}

// ── Fetch blocked countries ────────────────────────────────────────────────

export async function fetchBlockedCountries() {
  await requireSysAdmin();
  // Warm the in-memory cache in the Node.js server process
  await forceRefreshGeoBlocks();
  const countries = await getBlockedCountries();
  return countries.map((c) => ({
    id: c.id,
    countryCode: c.countryCode,
    countryName: c.countryName,
    reason: c.reason,
    isActive: c.isActive,
    createdBy: c.createdBy,
    createdAt: c.createdAt.toISOString(),
  }));
}

// ── Fetch full history (including disabled) ────────────────────────────────

export async function fetchGeoBlockHistory() {
  await requireSysAdmin();
  const countries = await getAllGeoBlockHistory();
  return countries.map((c) => ({
    id: c.id,
    countryCode: c.countryCode,
    countryName: c.countryName,
    reason: c.reason,
    isActive: c.isActive,
    createdBy: c.createdBy,
    createdAt: c.createdAt.toISOString(),
  }));
}

// ── Add a country to blocklist ─────────────────────────────────────────────

export async function addGeoBlock(formData: FormData) {
  const admin = await requireSysAdmin();
  const countryCode = (formData.get("countryCode") as string)?.trim().toUpperCase();
  const reason = (formData.get("reason") as string)?.trim() || "High-risk region";

  if (!countryCode || countryCode.length !== 2) {
    return { error: "Invalid country code. Must be a 2-letter ISO code." };
  }

  // Look up human-readable name
  const match = COUNTRY_LIST.find((c) => c.code === countryCode);
  const countryName = match?.name ?? countryCode;

  await addBlockedCountry({
    countryCode,
    countryName,
    reason,
    createdBy: admin.userId,
  });

  return { success: true };
}

// ── Bulk-add default red-flag countries ─────────────────────────────────────

export async function addDefaultGeoBlocks() {
  const admin = await requireSysAdmin();

  const defaults = [
    { code: "KP", name: "North Korea", reason: "OFAC sanctioned nation" },
    { code: "IR", name: "Iran", reason: "OFAC sanctioned nation" },
    { code: "CU", name: "Cuba", reason: "OFAC sanctioned nation" },
    { code: "SY", name: "Syria", reason: "OFAC sanctioned nation" },
    { code: "RU", name: "Russia", reason: "High-risk region — sanctions" },
  ];

  for (const d of defaults) {
    await addBlockedCountry({
      countryCode: d.code,
      countryName: d.name,
      reason: d.reason,
      createdBy: admin.userId,
    });
  }

  return { success: true, count: defaults.length };
}

// ── Remove a country from blocklist ────────────────────────────────────────

export async function removeGeoBlock(countryCode: string) {
  await requireSysAdmin();

  if (!countryCode || countryCode.length !== 2) {
    return { error: "Invalid country code" };
  }

  await removeBlockedCountry(countryCode.toUpperCase());
  return { success: true };
}

// ── Get the full country list for the dropdown ─────────────────────────────

export async function getCountryList() {
  await requireSysAdmin();
  return COUNTRY_LIST;
}
