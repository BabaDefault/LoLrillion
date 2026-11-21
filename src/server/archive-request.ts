import type { NextRequest, NextResponse } from "next/server";
import { parsePuzzleDay } from "@/engine";
import { ADMIN_COOKIE, hasAdminAccess } from "./admin-auth";
import { jsonWithDevice } from "./device";
import { ArchiveUnavailableError } from "./game-service";

/**
 * Runs a puzzle route for today's Puzzle, or for an archive run when the request has
 * `?day=YYYY-MM-DD`. A malformed or impossible date is a 400. The archive is admin-only, so an archive
 * day without the admin cookie is a 404, as is a day that isn't a past Puzzle Day.
 */
export async function withArchiveDay(
  request: NextRequest,
  device: { deviceId: string; isNew: boolean },
  handle: (archiveDay: string | undefined) => Promise<NextResponse>,
  env: Record<string, string | undefined> = process.env,
): Promise<NextResponse> {
  const day = request.nextUrl.searchParams.get("day");
  if (day !== null && parsePuzzleDay(day) === null) {
    return jsonWithDevice({ ok: false, error: "bad-request" }, device, 400);
  }
  if (day !== null && !hasAdminAccess(request.cookies.get(ADMIN_COOKIE)?.value, env)) {
    return jsonWithDevice({ ok: false, error: "archive-unavailable" }, device, 404);
  }
  try {
    return await handle(day ?? undefined);
  } catch (error) {
    if (error instanceof ArchiveUnavailableError) {
      return jsonWithDevice({ ok: false, error: "archive-unavailable" }, device, 404);
    }
    throw error;
  }
}
