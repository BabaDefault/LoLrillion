import type { NextRequest } from "next/server";
import { getLeaderboardService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

/** The player's nickname and friend groups. */
export async function GET(request: NextRequest) {
  const device = deviceIdFor(request);
  return jsonWithDevice(await getLeaderboardService().getProfile(device.deviceId), device);
}
