import type { NextRequest } from "next/server";
import { withArchiveDay } from "@/server/archive-request";
import { getGameService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

/**
 * The player's state for today's Puzzle (or a past one with `?day=`, in archive mode): only the
 * current Prompt's text, never an Answer Set.
 */
export async function GET(request: NextRequest) {
  const device = deviceIdFor(request);
  return withArchiveDay(request, device, async (day) => {
    const state = await getGameService().getState(device.deviceId, day);
    return jsonWithDevice(state, device);
  });
}
