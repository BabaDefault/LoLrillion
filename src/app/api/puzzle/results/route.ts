import type { NextRequest } from "next/server";
import { getGameService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

/** The end-screen reveal (Answer Sets included), only once all of today's Prompts are finished. */
export async function GET(request: NextRequest) {
  const device = deviceIdFor(request);
  const response = await getGameService().getResults(device.deviceId);
  return jsonWithDevice(response, device, response.ok ? 200 : 409);
}
