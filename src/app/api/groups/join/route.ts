import type { NextRequest } from "next/server";
import { getLeaderboardService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

const MAX_BODY_TEXT = 200;

/** Join a friend group by its code. Body: `{ code: string }`. */
export async function POST(request: NextRequest) {
  const device = deviceIdFor(request);
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = body?.code;
  if (typeof code !== "string" || code.length > MAX_BODY_TEXT) {
    return jsonWithDevice({ ok: false, error: "bad-request" }, device, 400);
  }
  const response = await getLeaderboardService().joinGroup(device.deviceId, code);
  const status = response.ok ? 200 : response.error === "no-such-group" ? 404 : 422;
  return jsonWithDevice(response, device, status);
}
