import { describe, expect, it } from "vitest";
import { createRiotClient, type RiotClientOptions } from "./riot-client";

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };

function harness(replies: Reply[], options: Partial<RiotClientOptions> = {}) {
  let t = 0;
  const sleeps: number[] = [];
  const requests: { url: string; token: string | null; at: number }[] = [];
  const queue = [...replies];
  const client = createRiotClient({
    apiKey: "RGAPI-test",
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
    fetch: async (url, init) => {
      requests.push({ url: String(url), token: new Headers(init?.headers).get("X-Riot-Token"), at: t });
      const reply = queue.shift() ?? { status: 200, body: [] };
      return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
        status: reply.status,
        headers: reply.headers,
      });
    },
    ...options,
  });
  return { client, sleeps, requests };
}

describe("Riot client", () => {
  it("sends the API key to the routing host and returns the JSON body", async () => {
    const { client, requests } = harness([{ status: 200, body: [{ championId: 62 }] }]);
    const body = await client.get("kr.api.riotgames.com", "/lol/champion-mastery/v4/x");
    expect(body).toEqual([{ championId: 62 }]);
    expect(requests).toEqual([
      { url: "https://kr.api.riotgames.com/lol/champion-mastery/v4/x", token: "RGAPI-test", at: 0 },
    ]);
  });

  it("waits for Retry-After when rate limited, then retries", async () => {
    const { client, sleeps, requests } = harness([
      { status: 429, headers: { "Retry-After": "3", "X-Rate-Limit-Type": "application" } },
      { status: 200, body: { ok: true } },
    ]);
    expect(await client.get("na1.api.riotgames.com", "/p")).toEqual({ ok: true });
    expect(sleeps).toContain(3000);
    expect(requests[1].at).toBeGreaterThanOrEqual(3000);
  });

  it("backs off exponentially on a 429 without Retry-After and on server errors", async () => {
    const { client, sleeps } = harness(
      [{ status: 429 }, { status: 503 }, { status: 200, body: 1 }],
      { baseBackoffMs: 1000 },
    );
    expect(await client.get("europe.api.riotgames.com", "/p")).toBe(1);
    expect(sleeps).toEqual([1000, 2000]);
  });

  it("gives up after the retry budget", async () => {
    const { client, requests } = harness(Array(10).fill({ status: 500 }), { maxRetries: 2 });
    await expect(client.get("kr.api.riotgames.com", "/p")).rejects.toThrow(/500/);
    expect(requests).toHaveLength(3);
  });

  it("returns null for not found, and fails fast on a rejected key", async () => {
    const { client } = harness([{ status: 404 }, { status: 403 }]);
    expect(await client.get("kr.api.riotgames.com", "/missing")).toBeNull();
    await expect(client.get("kr.api.riotgames.com", "/p")).rejects.toThrow(/RIOT_API_KEY/);
  });

  it("keeps each routing host under its own request limit", async () => {
    const { client, requests } = harness([], { limits: [{ requests: 2, perMs: 1000 }] });
    await client.get("kr.api.riotgames.com", "/1");
    await client.get("kr.api.riotgames.com", "/2");
    await client.get("na1.api.riotgames.com", "/3");
    await client.get("kr.api.riotgames.com", "/4");
    expect(requests.map((r) => r.at)).toEqual([0, 0, 0, 1000]);
  });
});
