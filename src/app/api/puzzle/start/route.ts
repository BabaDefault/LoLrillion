import type { NextRequest } from "next/server";
import { getGameService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

/** Start the current Prompt: records its window-open time (now + read window). Idempotent. */
export async function POST(request: NextRequest) {
  const device = deviceIdFor(request);
  const state = await getGameService().startPrompt(device.deviceId);
  return jsonWithDevice(state, device);
}
