import type { NextRequest } from "next/server";
import { getLeaderboardService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

/**
 * A Puzzle Day's leaderboard. Query: `day=YYYY-MM-DD` (today when omitted) and `group=CODE`
 * (a group's leaderboard, for its members; global when omitted).
 */
export async function GET(request: NextRequest) {
  const device = deviceIdFor(request);
  const params = request.nextUrl.searchParams;
  const response = await getLeaderboardService().getLeaderboard(device.deviceId, {
    day: params.get("day") ?? undefined,
    group: params.get("group") ?? undefined,
  });
  const status = response.ok ? 200 : response.error === "not-a-member" ? 403 : 400;
  return jsonWithDevice(response, device, status);
}
