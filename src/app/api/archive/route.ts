import type { NextRequest } from "next/server";
import { getGameService } from "@/server/container";
import { deviceIdFor, jsonWithDevice } from "@/server/device";

export const dynamic = "force-dynamic";

/** The archive: past Puzzle Days (never today or later), newest first, marked when finished. */
export async function GET(request: NextRequest) {
  const device = deviceIdFor(request);
  const days = await getGameService().listArchive(device.deviceId);
  return jsonWithDevice({ days }, device);
}
