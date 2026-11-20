import type { NextRequest } from "next/server";
import { getGameService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

/** The player's state for today's Puzzle: only the current Prompt's text, never an Answer Set. */
export async function GET(request: NextRequest) {
  const device = deviceIdFor(request);
  const state = await getGameService().getState(device.deviceId);
  return jsonWithDevice(state, device);
}
