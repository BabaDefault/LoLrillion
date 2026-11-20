import type { NextRequest } from "next/server";
import { getGameService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

/** Personal stats for this device: games played, average score, Tier counts, Gems found, best day. */
export async function GET(request: NextRequest) {
  const device = deviceIdFor(request);
  const stats = await getGameService().getStats(device.deviceId);
  return jsonWithDevice(stats, device);
}
