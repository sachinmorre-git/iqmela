/**
 * Safely parses a Prisma Json field into a string array.
 * Handles: null, undefined, string[], stringified JSON, and raw JSON objects.
 */
export function parseJsonArray(json: unknown): string[] {
  if (!json) return [];
  if (Array.isArray(json)) return json.map(String);
  try {
    const parsed = typeof json === "string" ? JSON.parse(json) : json;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
