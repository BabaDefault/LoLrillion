import type { NextRequest } from "next/server";
import { getLeaderboardService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

const MAX_BODY_TEXT = 200;

/** Create a friend group; the response carries its short code. Body: `{ name: string }`. */
export async function POST(request: NextRequest) {
  const device = deviceIdFor(request);
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = body?.name;
  if (typeof name !== "string" || name.length > MAX_BODY_TEXT) {
    return jsonWithDevice({ ok: false, error: "bad-request" }, device, 400);
  }
  const response = await getLeaderboardService().createGroup(device.deviceId, name);
  return jsonWithDevice(response, device, response.ok ? 200 : 422);
}
