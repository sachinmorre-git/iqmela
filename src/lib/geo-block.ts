/**
 * src/lib/geo-block.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Country-Level Geo-Blocking System
 *
 * This file is EDGE-SAFE — no Prisma import at the top level.
 * The middleware imports only `isCountryBlocked` (pure in-memory check).
 * All DB operations use dynamic imports to avoid Edge runtime issues.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── In-Memory Country Block Cache ──────────────────────────────────────────
// Fast O(1) lookup for middleware — populated by admin server actions

const blockedCountries = new Set<string>();

// ── ISO-3166 Country Code → Name Map (common countries for the UI) ─────────

export const COUNTRY_LIST: { code: string; name: string; region: string }[] = [
  // High-risk (commonly blocked)
  { code: "KP", name: "North Korea", region: "Asia" },
  { code: "IR", name: "Iran", region: "Middle East" },
  { code: "CU", name: "Cuba", region: "Americas" },
  { code: "SY", name: "Syria", region: "Middle East" },
  { code: "RU", name: "Russia", region: "Europe" },
  { code: "BY", name: "Belarus", region: "Europe" },
  { code: "MM", name: "Myanmar", region: "Asia" },
  { code: "VE", name: "Venezuela", region: "Americas" },
  { code: "SD", name: "Sudan", region: "Africa" },
  { code: "SS", name: "South Sudan", region: "Africa" },
  // Africa
  { code: "NG", name: "Nigeria", region: "Africa" },
  { code: "GH", name: "Ghana", region: "Africa" },
  { code: "CM", name: "Cameroon", region: "Africa" },
  { code: "KE", name: "Kenya", region: "Africa" },
  { code: "ZA", name: "South Africa", region: "Africa" },
  { code: "EG", name: "Egypt", region: "Africa" },
  { code: "ET", name: "Ethiopia", region: "Africa" },
  { code: "TZ", name: "Tanzania", region: "Africa" },
  { code: "DZ", name: "Algeria", region: "Africa" },
  { code: "MA", name: "Morocco", region: "Africa" },
  // Asia
  { code: "CN", name: "China", region: "Asia" },
  { code: "PK", name: "Pakistan", region: "Asia" },
  { code: "BD", name: "Bangladesh", region: "Asia" },
  { code: "IN", name: "India", region: "Asia" },
  { code: "VN", name: "Vietnam", region: "Asia" },
  { code: "PH", name: "Philippines", region: "Asia" },
  { code: "ID", name: "Indonesia", region: "Asia" },
  { code: "TH", name: "Thailand", region: "Asia" },
  { code: "AF", name: "Afghanistan", region: "Asia" },
  { code: "IQ", name: "Iraq", region: "Middle East" },
  { code: "YE", name: "Yemen", region: "Middle East" },
  { code: "LB", name: "Lebanon", region: "Middle East" },
  // Europe
  { code: "UA", name: "Ukraine", region: "Europe" },
  { code: "RO", name: "Romania", region: "Europe" },
  { code: "BG", name: "Bulgaria", region: "Europe" },
  { code: "AL", name: "Albania", region: "Europe" },
  // Americas
  { code: "BR", name: "Brazil", region: "Americas" },
  { code: "CO", name: "Colombia", region: "Americas" },
  { code: "MX", name: "Mexico", region: "Americas" },
  { code: "NI", name: "Nicaragua", region: "Americas" },
];

// ── Check if a country is blocked (EDGE-SAFE — pure in-memory) ────────────

export function isCountryBlocked(countryCode: string | null): {
  blocked: boolean;
  countryCode?: string;
} {
  if (!countryCode) return { blocked: false };
  const code = countryCode.toUpperCase().trim();
  if (blockedCountries.has(code)) {
    return { blocked: true, countryCode: code };
  }
  return { blocked: false };
}

// ── Sync from DB to in-memory cache ────────────────────────────────────────
// Uses dynamic import to avoid top-level Prisma dependency (Edge-safe)

let lastSync = 0;
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export async function syncGeoBlocksFromDb(): Promise<void> {
  const now = Date.now();
  if (now - lastSync < SYNC_INTERVAL) return;
  lastSync = now;

  try {
    const { prisma } = await import("@/lib/prisma");
    const countries = await prisma.geoBlockedCountry.findMany({
      where: { isActive: true },
      select: { countryCode: true },
    });

    blockedCountries.clear();
    for (const c of countries) {
      blockedCountries.add(c.countryCode.toUpperCase());
    }
  } catch {
    // Silently fail — existing in-memory cache still works
  }
}

// ── Force-sync (called after admin makes changes) ──────────────────────────

export async function forceRefreshGeoBlocks(): Promise<void> {
  lastSync = 0;
  await syncGeoBlocksFromDb();
}

// ── Admin CRUD operations (use dynamic prisma import) ──────────────────────

export async function addBlockedCountry(input: {
  countryCode: string;
  countryName: string;
  reason?: string;
  createdBy: string;
}): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const code = input.countryCode.toUpperCase().trim();

  await prisma.geoBlockedCountry.upsert({
    where: { countryCode: code },
    update: {
      isActive: true,
      reason: input.reason ?? "High-risk region",
      countryName: input.countryName,
      createdBy: input.createdBy,
    },
    create: {
      countryCode: code,
      countryName: input.countryName,
      reason: input.reason ?? "High-risk region",
      createdBy: input.createdBy,
    },
  });

  // Immediately update in-memory cache
  blockedCountries.add(code);
}

export async function removeBlockedCountry(countryCode: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const code = countryCode.toUpperCase().trim();

  await prisma.geoBlockedCountry.updateMany({
    where: { countryCode: code },
    data: { isActive: false },
  });

  blockedCountries.delete(code);
}

export async function getBlockedCountries() {
  const { prisma } = await import("@/lib/prisma");
  return prisma.geoBlockedCountry.findMany({
    where: { isActive: true },
    orderBy: { countryName: "asc" },
  });
}

export async function getAllGeoBlockHistory() {
  const { prisma } = await import("@/lib/prisma");
  return prisma.geoBlockedCountry.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}
