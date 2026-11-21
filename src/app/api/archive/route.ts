import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, hasAdminAccess } from "@/server/admin-auth";
import { getGameService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

/**
 * The archive: past Puzzle Days (never today or later), newest first, marked when finished.
 * Admin-only: without the admin cookie it is a 404.
 */
export async function GET(request: NextRequest) {
  const device = deviceIdFor(request);
  if (!hasAdminAccess(request.cookies.get(ADMIN_COOKIE)?.value, process.env)) {
    return jsonWithDevice({ ok: false, error: "archive-unavailable" }, device, 404);
  }
  const days = await getGameService().listArchive(device.deviceId);
  return jsonWithDevice({ days }, device);
}
