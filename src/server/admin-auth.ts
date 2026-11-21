import { createHash, timingSafeEqual } from "node:crypto";

/** The cookie that unlocks the admin dashboard on this browser. */
export const ADMIN_COOKIE = "lolrillion_admin";

/**
 * The admin key from LOLRILLION_ADMIN_KEY, or null when it isn't set (the dashboard then doesn't
 * exist). Keys shorter than 16 characters are refused, so a placeholder never guards the Answer Sets.
 */
export function adminKey(env: Record<string, string | undefined>): string | null {
  const key = env.LOLRILLION_ADMIN_KEY?.trim();
  if (!key) return null;
  if (key.length < 16) throw new Error("LOLRILLION_ADMIN_KEY must be at least 16 characters");
  return key;
}

/** The cookie value for a key: a hash, so the key itself is never stored in the browser. */
export function adminToken(key: string): string {
  return createHash("sha256").update(`lolrillion-admin:${key}`).digest("hex");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Whether a typed key is the admin key (constant-time). */
export function isAdminKey(typed: string, key: string): boolean {
  return same(adminToken(typed.trim()), adminToken(key));
}

/** Whether a cookie value unlocks the dashboard for this key (constant-time). */
export function isAdminToken(cookie: string | undefined, key: string): boolean {
  return cookie !== undefined && same(cookie, adminToken(key));
}

/**
 * Whether a request's admin cookie unlocks admin-only pages (the dashboard and the archive). Never
 * true when LOLRILLION_ADMIN_KEY isn't set.
 */
export function hasAdminAccess(cookie: string | undefined, env: Record<string, string | undefined>): boolean {
  const key = adminKey(env);
  return key !== null && isAdminToken(cookie, key);
}
