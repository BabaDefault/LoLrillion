import { describe, expect, it } from "vitest";
import challenger from "./__fixtures__/league-challenger.json";
import gold from "./__fixtures__/league-entries-gold.json";
import masteryA from "./__fixtures__/mastery-a.json";
import match1 from "./__fixtures__/match-1.json";
import match2 from "./__fixtures__/match-2.json";
import type { RiotClient } from "./riot-client";
import { parseSampleConfig, sampleFamiliarity } from "./sample";
import type { FamiliarityCatalog } from "./tally";

const catalog: FamiliarityCatalog = {
  patch: "16.23.1",
  champions: [
    { id: "Aatrox", key: 266 },
    { id: "Ahri", key: 103 },
    { id: "MonkeyKing", key: 62 },
  ],
  items: [{ id: "3071" }, { id: "3047" }],
};

/** A fake Riot API answering from saved responses. */
function fakeRiot() {
  const calls: string[] = [];
  const client: RiotClient = {
    async get(host, path) {
      calls.push(`${host}${path}`);
      if (path.includes("/challengerleagues/")) return challenger;
      if (path.includes("/entries/RANKED_SOLO_5x5/GOLD/")) return gold;
      if (path.includes("/champion-masteries/by-puuid/")) return masteryA;
      if (path.includes("/ids")) {
        return host.startsWith("americas") ? ["NA1_1000000001"] : ["KR_2000000002"];
      }
      if (path.endsWith("/NA1_1000000001")) return match1;
      if (path.endsWith("/KR_2000000002")) return match2;
      return null;
    },
  };
  return { client, calls };
}

describe("sampleFamiliarity", () => {
  const run = async () => {
    const riot = fakeRiot();
    const file = await sampleFamiliarity({
      client: riot.client,
      catalog,
      config: { platforms: ["na1", "kr"], tiers: ["GOLD", "CHALLENGER"], playersPerBucket: 1, matchesPerPlayer: 5 },
      random: () => 0,
    });
    return { file, calls: riot.calls };
  };

  it("samples every configured platform and tier", async () => {
    const { file, calls } = await run();
    const leagueCalls = calls.filter((c) => c.includes("/lol/league/v4/"));
    expect(leagueCalls.sort()).toEqual([
      "kr.api.riotgames.com/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5",
      "kr.api.riotgames.com/lol/league/v4/entries/RANKED_SOLO_5x5/GOLD/I?page=1",
      "na1.api.riotgames.com/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5",
      "na1.api.riotgames.com/lol/league/v4/entries/RANKED_SOLO_5x5/GOLD/I?page=1",
    ]);
    expect(file.sample?.buckets).toEqual({ "na1/GOLD": 1, "na1/CHALLENGER": 1, "kr/GOLD": 1, "kr/CHALLENGER": 1 });
  });

  it("asks each player's regional host for recent ranked solo matches and fetches each match once", async () => {
    const { file, calls } = await run();
    const idCalls = calls.filter((c) => c.includes("/ids?"));
    expect(idCalls).toHaveLength(4);
    expect(idCalls.filter((c) => c.startsWith("americas.api.riotgames.com"))).toHaveLength(2);
    expect(idCalls.filter((c) => c.startsWith("asia.api.riotgames.com"))).toHaveLength(2);
    expect(idCalls.every((c) => c.includes("queue=420") && c.includes("count=5"))).toBe(true);
    expect(calls.filter((c) => /\/matches\/[A-Z0-9]+_\d+$/.test(c))).toHaveLength(2);
    expect(file.sample).toMatchObject({ players: 4, matches: 2 });
  });

  it("totals mastery and matches into the Familiarity file", async () => {
    const { file } = await run();
    // Every sampled player returns mastery-a: Wukong 300k, Aatrox 100k.
    expect(file.champions["champion:MonkeyKing"]).toEqual({ mastery: 0.75, pickRate: 1 });
    expect(file.items["item:3071"].buildRate).toBe(0.75);
  });

  it("keeps no PUUIDs or match IDs in its output", async () => {
    const { file } = await run();
    expect(JSON.stringify(file)).not.toMatch(/PUUID|SUMMONER|NA1_|KR_/);
  });
});

describe("parseSampleConfig", () => {
  it("defaults to every platform and tier", () => {
    const config = parseSampleConfig([]);
    expect(config.platforms).toHaveLength(16);
    expect(config.tiers).toEqual([
      "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER",
    ]);
  });

  it("reads the spread from flags", () => {
    expect(parseSampleConfig(["--platforms=na1,KR", "--tiers=gold,challenger", "--players=3", "--matches=7"])).toMatchObject({
      platforms: ["na1", "kr"],
      tiers: ["GOLD", "CHALLENGER"],
      playersPerBucket: 3,
      matchesPerPlayer: 7,
    });
  });

  it("rejects unknown platforms and tiers", () => {
    expect(() => parseSampleConfig(["--platforms=xx1"])).toThrow(/xx1/);
    expect(() => parseSampleConfig(["--tiers=WOOD"])).toThrow(/WOOD/);
  });
});
