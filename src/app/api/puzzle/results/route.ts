import type { NextRequest } from "next/server";
import { withArchiveDay } from "@/server/archive-request";
import { getGameService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

/**
 * The end-screen reveal (Answer Sets included), only once all of the run's Prompts are finished.
 * `?day=` is an archive run of that past Puzzle.
 */
export async function GET(request: NextRequest) {
  const device = deviceIdFor(request);
  return withArchiveDay(request, device, async (day) => {
    const response = await getGameService().getResults(device.deviceId, day);
    return jsonWithDevice(response, device, response.ok ? 200 : 409);
  });
}
