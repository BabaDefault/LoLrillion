import type { NextRequest, NextResponse } from "next/server";
import { jsonWithDevice } from "./device";
import { ArchiveUnavailableError } from "./game-service";

const PUZZLE_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Runs a puzzle route for today's Puzzle, or for an archive run when the request has
 * `?day=YYYY-MM-DD`. A malformed day is a 400; a day that isn't a past Puzzle Day is a 404.
 */
export async function withArchiveDay(
  request: NextRequest,
  device: { deviceId: string; isNew: boolean },
  handle: (archiveDay: string | undefined) => Promise<NextResponse>,
): Promise<NextResponse> {
  const day = request.nextUrl.searchParams.get("day");
  if (day !== null && !PUZZLE_DAY.test(day)) {
    return jsonWithDevice({ ok: false, error: "bad-request" }, device, 400);
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
