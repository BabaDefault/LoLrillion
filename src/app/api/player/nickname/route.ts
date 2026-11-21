import type { NextRequest } from "next/server";
import { getLeaderboardService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

const MAX_BODY_TEXT = 200;

/** Set or change the player's nickname. Body: `{ nickname: string }`. */
export async function POST(request: NextRequest) {
  const device = deviceIdFor(request);
  const body = (await request.json().catch(() => null)) as { nickname?: unknown } | null;
  const nickname = body?.nickname;
  if (typeof nickname !== "string" || nickname.length > MAX_BODY_TEXT) {
    return jsonWithDevice({ ok: false, error: "bad-request" }, device, 400);
  }
  const response = await getLeaderboardService().setNickname(device.deviceId, nickname);
  return jsonWithDevice(response, device, response.ok ? 200 : 422);
}
