import { NextResponse, type NextRequest } from "next/server";

const DEVICE_COOKIE = "lolrillion_device";
const ONE_YEAR_S = 60 * 60 * 24 * 365;

/** The anonymous device ID for a request, creating one if the client has none yet. */
export function deviceIdFor(request: NextRequest): { deviceId: string; isNew: boolean } {
  const existing = request.cookies.get(DEVICE_COOKIE)?.value;
  if (existing) return { deviceId: existing, isNew: false };
  return { deviceId: crypto.randomUUID(), isNew: true };
}

/** A JSON response that also persists a newly created device ID. */
export function jsonWithDevice(body: unknown, device: { deviceId: string; isNew: boolean }, status = 200) {
  const response = NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (device.isNew) {
    response.cookies.set(DEVICE_COOKIE, device.deviceId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR_S,
    });
  }
  return response;
}
