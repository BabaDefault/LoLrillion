import type { NextRequest } from "next/server";
import { withArchiveDay } from "@/server/archive-request";
import { getGameService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

/**
 * The end-screen reveal (Answer Sets included): today's only once all of its Prompts are finished.
 * `?day=` is that past Puzzle's results, viewable whether or not this device played it.
 */
export async function GET(request: NextRequest) {
  const device = deviceIdFor(request);
  return withArchiveDay(request, device, async (day) => {
    const response = await getGameService().getResults(device.deviceId, day);
    return jsonWithDevice(response, device, response.ok ? 200 : 409);
  });
}
