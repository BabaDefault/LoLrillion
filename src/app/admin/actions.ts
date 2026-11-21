"use server";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ADMIN_COOKIE, adminKey, adminToken, isAdminKey } from "@/server/admin-auth";

/** 30 days, in seconds. */
const MAX_AGE = 30 * 24 * 60 * 60;

/** Unlocks the dashboard and the archive on this browser when the typed key is the admin key. */
export async function unlock(formData: FormData) {
  const key = adminKey(process.env);
  if (!key) notFound();
  const typed = formData.get("key");
  if (typeof typed !== "string" || !isAdminKey(typed, key)) redirect("/admin?wrong=1");
  (await cookies()).set(ADMIN_COOKIE, adminToken(key), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    // Site-wide, so the archive pages and their API calls see it too.
    path: "/",
    maxAge: MAX_AGE,
  });
  redirect("/admin");
}

/** Locks the dashboard and the archive again on this browser. */
export async function lock() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  // Cookies set before the archive was admin-only were scoped to /admin.
  jar.set(ADMIN_COOKIE, "", { path: "/admin", maxAge: 0 });
  redirect("/admin");
}
