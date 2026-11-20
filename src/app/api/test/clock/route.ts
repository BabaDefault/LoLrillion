import { NextResponse, type NextRequest } from "next/server";
import { smokeControls } from "@/server/container";

export const dynamic = "force-dynamic";

/**
 * Smoke-test only: jump the server clock forward. Body: `{ advanceMs: number }`.
 * 404 unless the server runs in smoke-test mode (never in production).
 */
export async function POST(request: NextRequest) {
  const controls = smokeControls();
  if (!controls) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { advanceMs?: unknown } | null;
  const advanceMs = body?.advanceMs;
  if (typeof advanceMs !== "number" || !Number.isFinite(advanceMs) || advanceMs < 0) {
    return NextResponse.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, now: controls.advance(advanceMs) }, { headers: { "Cache-Control": "no-store" } });
}
