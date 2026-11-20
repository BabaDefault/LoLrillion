import type { NextRequest } from "next/server";
import { getGameService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

const MAX_GUESS_LENGTH = 100;

/**
 * Submit an Attempt for the current Prompt. Body: `{ promptIndex: number, guess: string }`, or
 * `{ promptIndex: number, entityId: string }` to confirm a "Did you mean" suggestion.
 */
export async function POST(request: NextRequest) {
  const device = deviceIdFor(request);
  const body = (await request.json().catch(() => null)) as
    | { promptIndex?: unknown; guess?: unknown; entityId?: unknown }
    | null;
  const { promptIndex, guess, entityId } = body ?? {};
  const game = getGameService();
  if (typeof promptIndex === "number" && typeof entityId === "string" && entityId.length <= MAX_GUESS_LENGTH) {
    const response = await game.confirmSuggestion(device.deviceId, promptIndex, entityId);
    return jsonWithDevice(response, device, response.ok ? 200 : 409);
  }
  if (typeof promptIndex !== "number" || typeof guess !== "string" || guess.length > MAX_GUESS_LENGTH) {
    return jsonWithDevice({ ok: false, error: "bad-request" }, device, 400);
  }
  const response = await game.submitAttempt(device.deviceId, promptIndex, guess);
  return jsonWithDevice(response, device, response.ok ? 200 : 409);
}
