import type { NextRequest } from "next/server";
import { getGameService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

/** End-screen comparison with today's players. 409 until the player has finished the Puzzle. */
export async function GET(request: NextRequest) {
  const device = deviceIdFor(request);
  const stats = await getGameService().getDayStats(device.deviceId);
  if (!stats) return jsonWithDevice({ error: "not-finished" }, device, 409);
  return jsonWithDevice(stats, device);
}
