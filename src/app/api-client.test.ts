import { afterEach, describe, expect, it, vi } from "vitest";
import { apiJson } from "./api-client";

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiJson, the client's one way to call the API", () => {
  it("resolves a 2xx response with its body", async () => {
    respond(200, { puzzleDay: "2026-11-20" });
    expect(await apiJson<{ puzzleDay: string }>("/api/puzzle/state")).toEqual({
      ok: true,
      status: 200,
      body: { puzzleDay: "2026-11-20" },
    });
  });

  it("resolves a refusal (400 bad-request, 404 archive-unavailable) with its error code instead of throwing", async () => {
    respond(400, { ok: false, error: "bad-request" });
    expect(await apiJson("/api/puzzle/attempt", { promptIndex: 0 })).toEqual({
      ok: false,
      status: 400,
      error: "bad-request",
      body: { ok: false, error: "bad-request" },
    });
    respond(404, { ok: false, error: "archive-unavailable" });
    expect(await apiJson("/api/puzzle/state?day=2026-01-01")).toMatchObject({ ok: false, error: "archive-unavailable" });
  });

  it("keeps the body of a refusal that carries more, like a 409 with the Puzzle state", async () => {
    respond(409, { ok: false, error: "not-current-prompt", state: { finished: false } });
    expect(await apiJson("/api/puzzle/attempt", {})).toMatchObject({
      ok: false,
      status: 409,
      error: "not-current-prompt",
      body: { state: { finished: false } },
    });
  });

  it("POSTs JSON when given a body, GETs without one, never cached", async () => {
    const fetchMock = respond(200, {});
    await apiJson("/api/puzzle/start", {});
    await apiJson("/api/puzzle/state");
    expect(fetchMock.mock.calls).toEqual([
      [
        "/api/puzzle/start",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store" },
      ],
      ["/api/puzzle/state", { method: "GET", headers: undefined, body: undefined, cache: "no-store" }],
    ]);
  });

  it("rejects when the network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(apiJson("/api/puzzle/state")).rejects.toThrow();
  });
});
