import type { NextRequest } from "next/server";
import { withArchiveDay } from "@/server/archive-request";
import { getGameService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

const MAX_GUESS_LENGTH = 100;

/**
 * Submit an Attempt for the current Prompt. Body: `{ promptIndex: number, guess: string }`, or
 * `{ promptIndex: number, entityId: string, guess?: string }` to confirm a "Did you mean"
 * suggestion (`guess` being the typed Guess that brought it up, for the Attempt log).
 * `?day=` submits it to an archive run of that past Puzzle.
 */
export async function POST(request: NextRequest) {
  const device = deviceIdFor(request);
  const body = (await request.json().catch(() => null)) as
    | { promptIndex?: unknown; guess?: unknown; entityId?: unknown }
    | null;
  const { promptIndex, guess, entityId } = body ?? {};
  const game = getGameService();
  return withArchiveDay(request, device, async (day) => {
    if (typeof promptIndex === "number" && typeof entityId === "string" && entityId.length <= MAX_GUESS_LENGTH) {
      const typed = typeof guess === "string" && guess.length <= MAX_GUESS_LENGTH ? guess : undefined;
      const response = await game.confirmSuggestion(device.deviceId, promptIndex, entityId, day, typed);
      return jsonWithDevice(response, device, response.ok ? 200 : 409);
    }
    if (typeof promptIndex !== "number" || typeof guess !== "string" || guess.length > MAX_GUESS_LENGTH) {
      return jsonWithDevice({ ok: false, error: "bad-request" }, device, 400);
    }
    const response = await game.submitAttempt(device.deviceId, promptIndex, guess, day);
    return jsonWithDevice(response, device, response.ok ? 200 : 409);
  });
}
