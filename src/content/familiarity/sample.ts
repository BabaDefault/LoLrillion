import type { RiotClient } from "./riot-client";
import { tallyFamiliarity, type FamiliarityCatalog } from "./tally";
import type { FamiliarityFile } from "./types";

/** Platform routing value -> Match-V5 regional host prefix. */
export const PLATFORM_REGIONS = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  kr: "asia",
  jp1: "asia",
  oc1: "sea",
  ph2: "sea",
  sg2: "sea",
  th2: "sea",
  tw2: "sea",
  vn2: "sea",
} as const;
export type Platform = keyof typeof PLATFORM_REGIONS;
export const PLATFORMS = Object.keys(PLATFORM_REGIONS) as Platform[];

export const DIVISION_TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"] as const;
export const APEX_TIERS = ["MASTER", "GRANDMASTER", "CHALLENGER"] as const;
export type RankedTier = (typeof DIVISION_TIERS)[number] | (typeof APEX_TIERS)[number];
export const TIERS: RankedTier[] = [...DIVISION_TIERS, ...APEX_TIERS];
const DIVISIONS = ["I", "II", "III", "IV"] as const;

const QUEUE = "RANKED_SOLO_5x5";
const QUEUE_ID = 420;

/** How the sample is spread: the same number of players from every (platform, tier) bucket. */
export interface SampleConfig {
  platforms: Platform[];
  tiers: RankedTier[];
  playersPerBucket: number;
  /** Recent ranked solo matches requested per player (Match-V5 allows up to 100). */
  matchesPerPlayer: number;
  /** Only list matches after this time (epoch seconds), e.g. the patch's release. Optional. */
  startTime?: number;
  /** Divisional tiers: a random page in 1..maxPage is read. Default 5. */
  maxPage?: number;
}

export const DEFAULT_SAMPLE_CONFIG: SampleConfig = {
  platforms: PLATFORMS,
  tiers: TIERS,
  playersPerBucket: 5,
  matchesPerPlayer: 10,
};

/** Reads `--platforms=na1,kr --tiers=gold,diamond --players=5 --matches=10 --since=2026-11-12 --max-page=5`. */
export function parseSampleConfig(args: readonly string[]): SampleConfig {
  const config: SampleConfig = { ...DEFAULT_SAMPLE_CONFIG };
  for (const arg of args) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!match) continue;
    const [, name, value] = match;
    const list = value.split(",").map((v) => v.trim()).filter(Boolean);
    switch (name) {
      case "platforms":
        config.platforms = list.map((p) => {
          const platform = p.toLowerCase();
          if (!(platform in PLATFORM_REGIONS)) throw new Error(`Unknown platform "${p}" (use ${PLATFORMS.join(", ")})`);
          return platform as Platform;
        });
        break;
      case "tiers":
        config.tiers = list.map((t) => {
          const tier = t.toUpperCase() as RankedTier;
          if (!TIERS.includes(tier)) throw new Error(`Unknown tier "${t}" (use ${TIERS.join(", ")})`);
          return tier;
        });
        break;
      case "players":
        config.playersPerBucket = positiveInt(name, value);
        break;
      case "matches":
        config.matchesPerPlayer = Math.min(100, positiveInt(name, value));
        break;
      case "max-page":
        config.maxPage = positiveInt(name, value);
        break;
      case "since": {
        const ms = Date.parse(value);
        if (Number.isNaN(ms)) throw new Error(`--since must be a date, got "${value}"`);
        config.startTime = Math.floor(ms / 1000);
        break;
      }
      default:
        throw new Error(`Unknown flag --${name}`);
    }
  }
  return config;
}

function positiveInt(name: string, value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} must be a positive integer, got "${value}"`);
  return n;
}

export interface SampleInput {
  client: RiotClient;
  catalog: FamiliarityCatalog;
  config: SampleConfig;
  /** Injectable for tests. Default Math.random. */
  random?: () => number;
  log?: (message: string) => void;
}

/**
 * Samples ranked players evenly across platforms and tiers, reads their lifetime Champion Mastery and
 * recent ranked matches, and totals everything into a Familiarity file.
 *
 * PUUIDs and match IDs live only in local variables while the run is in progress; responses are trimmed
 * to the fields the totals need as soon as they arrive, and the result holds only anonymous totals.
 */
export async function sampleFamiliarity({
  client,
  catalog,
  config,
  random = Math.random,
  log = () => {},
}: SampleInput): Promise<FamiliarityFile> {
  const masteries: unknown[] = [];
  const matches: unknown[] = [];
  const seenMatches = new Set<string>();
  const buckets: Record<string, number> = {};

  // Platforms run in parallel (each has its own rate-limit bucket); tiers within a platform run in turn.
  await Promise.all(
    config.platforms.map(async (platform) => {
      const platformHost = `${platform}.api.riotgames.com`;
      const regionHost = `${PLATFORM_REGIONS[platform]}.api.riotgames.com`;
      for (const tier of config.tiers) {
        const puuids = await samplePlayers(client, platformHost, tier, config, random);
        buckets[`${platform}/${tier}`] = puuids.length;
        log(`${platform}/${tier}: ${puuids.length} players`);
        for (const puuid of puuids) {
          const mastery = await client.get(
            platformHost,
            `/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}`,
          );
          masteries.push(trimMastery(mastery));

          const params = new URLSearchParams({
            queue: String(QUEUE_ID),
            type: "ranked",
            start: "0",
            count: String(config.matchesPerPlayer),
          });
          if (config.startTime !== undefined) params.set("startTime", String(config.startTime));
          const ids = await client.get(
            regionHost,
            `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?${params}`,
          );
          for (const id of Array.isArray(ids) ? ids : []) {
            if (typeof id !== "string" || seenMatches.has(id)) continue;
            seenMatches.add(id);
            const match = await client.get(regionHost, `/lol/match/v5/matches/${encodeURIComponent(id)}`);
            if (match) matches.push(trimMatch(match));
          }
        }
      }
    }),
  );

  const file = tallyFamiliarity({ catalog, masteries, matches });
  const ordered: Record<string, number> = {};
  for (const platform of config.platforms) {
    for (const tier of config.tiers) ordered[`${platform}/${tier}`] = buckets[`${platform}/${tier}`] ?? 0;
  }
  return { ...file, sample: { ...file.sample!, buckets: ordered } };
}

async function samplePlayers(
  client: RiotClient,
  host: string,
  tier: RankedTier,
  config: SampleConfig,
  random: () => number,
): Promise<string[]> {
  let entries: unknown;
  if ((APEX_TIERS as readonly string[]).includes(tier)) {
    const league = await client.get(host, `/lol/league/v4/${tier.toLowerCase()}leagues/by-queue/${QUEUE}`);
    entries = (league as any)?.entries;
  } else {
    const division = DIVISIONS[Math.floor(random() * DIVISIONS.length)];
    const page = 1 + Math.floor(random() * (config.maxPage ?? 5));
    const path = (p: number) => `/lol/league/v4/entries/${QUEUE}/${tier}/${division}?page=${p}`;
    entries = await client.get(host, path(page));
    if (page > 1 && (!Array.isArray(entries) || entries.length === 0)) entries = await client.get(host, path(1));
  }
  // Entries without a PUUID (older response shape) are skipped rather than resolved via Summoner-V4.
  const puuids = (Array.isArray(entries) ? entries : [])
    .map((e) => e?.puuid)
    .filter((p): p is string => typeof p === "string" && p.length > 0);
  for (let i = puuids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [puuids[i], puuids[j]] = [puuids[j], puuids[i]];
  }
  return puuids.slice(0, config.playersPerBucket);
}

function trimMastery(response: unknown): unknown {
  if (!Array.isArray(response)) return null;
  return response.map((e) => ({ championId: e?.championId, championPoints: e?.championPoints }));
}

function trimMatch(response: unknown): unknown {
  const info = (response as any)?.info;
  if (!info || !Array.isArray(info.participants)) return null;
  return {
    info: {
      gameVersion: info.gameVersion,
      participants: info.participants.map((p: any) => ({
        championId: p?.championId,
        item0: p?.item0,
        item1: p?.item1,
        item2: p?.item2,
        item3: p?.item3,
        item4: p?.item4,
        item5: p?.item5,
      })),
    },
  };
}
