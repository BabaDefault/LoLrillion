import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { withArchiveDay } from "./archive-request";

const device = { deviceId: "device-1", isNew: false };

async function statusFor(query: string): Promise<{ status: number; day: string | undefined | null }> {
  let day: string | undefined | null = null;
  const res = await withArchiveDay(new NextRequest(`http://localhost/api/puzzle/state${query}`), device, async (d) => {
    day = d;
    return NextResponse.json({ ok: true });
  });
  return { status: res.status, day };
}

describe("archive day in a puzzle request", () => {
  it("passes a real calendar date through as the archive day", async () => {
    expect(await statusFor("?day=2026-11-20")).toEqual({ status: 200, day: "2026-11-20" });
  });

  it("is today's Puzzle when no day is given", async () => {
    expect(await statusFor("")).toEqual({ status: 200, day: undefined });
  });

  it("refuses a malformed or impossible date as a bad request", async () => {
    for (const day of ["yesterday", "2026-1-2", "2026-13-45", "2026-02-30"]) {
      expect(await statusFor(`?day=${day}`), day).toEqual({ status: 400, day: null });
    }
  });
});
