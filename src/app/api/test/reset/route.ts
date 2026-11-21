import { NextResponse } from "next/server";
import { smokeControls } from "@/server/container";

export const dynamic = "force-dynamic";

/**
 * Smoke-test only: empty the in-memory stores and put the clock back to its start.
 * 404 unless the server runs in smoke-test mode (never in production).
 */
export async function POST() {
  const controls = smokeControls();
  if (!controls) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  return NextResponse.json({ ok: true, now: controls.reset() }, { headers: { "Cache-Control": "no-store" } });
}
