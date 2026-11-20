import type { NextRequest } from "next/server";
import { withArchiveDay } from "@/server/archive-request";
import { getGameService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

/**
 * Start the current Prompt: records its window-open time (now + read window). Idempotent.
 * `?day=` starts it in an archive run of that past Puzzle.
 */
export async function POST(request: NextRequest) {
  const device = deviceIdFor(request);
  return withArchiveDay(request, device, async (day) => {
    const state = await getGameService().startPrompt(device.deviceId, day);
    return jsonWithDevice(state, device);
  });
}
