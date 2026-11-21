import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { ADMIN_COOKIE, adminToken } from "./admin-auth";
import { withArchiveDay } from "./archive-request";

const device = { deviceId: "device-1", isNew: false };
const KEY = "correct-horse-battery-staple";
const env = { LOLRILLION_ADMIN_KEY: KEY };

async function statusFor(
  query: string,
  cookie: string | null = adminToken(KEY),
): Promise<{ status: number; day: string | undefined | null }> {
  let day: string | undefined | null = null;
  const headers = cookie === null ? undefined : { cookie: `${ADMIN_COOKIE}=${cookie}` };
  const request = new NextRequest(`http://localhost/api/puzzle/state${query}`, { headers });
  const res = await withArchiveDay(
    request,
    device,
    async (d) => {
      day = d;
      return NextResponse.json({ ok: true });
    },
    env,
  );
  return { status: res.status, day };
}

describe("the archive is admin-only", () => {
  it("refuses an archive day without the admin cookie, as if the archive didn't exist", async () => {
    expect(await statusFor("?day=2026-11-20", null)).toEqual({ status: 404, day: null });
    expect(await statusFor("?day=2026-11-20", adminToken("some-other-key-long-enough"))).toEqual({ status: 404, day: null });
  });

  it("refuses an archive day when no admin key is configured", async () => {
    let called = false;
    const request = new NextRequest("http://localhost/api/puzzle/state?day=2026-11-20");
    const res = await withArchiveDay(request, device, async () => ((called = true), NextResponse.json({})), {});
    expect([res.status, called]).toEqual([404, false]);
  });

  it("still serves today's Puzzle to everyone", async () => {
    expect(await statusFor("", null)).toEqual({ status: 200, day: undefined });
  });
});

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
