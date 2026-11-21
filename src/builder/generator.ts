import { addDays, daysBetween, ESPORTS_ANSWER_TYPES, puzzleNumberOf, type Tier } from "@/engine";
import type { BuiltPrompt } from "./types";

export const PROMPTS_PER_PUZZLE = 7;

/**
 * Default generator constraints (spec: Answer Sets of about 8-100, a few rare answers, one esports
 * Prompt at most). There is no cap per Answer Type: the mix is left to chance so a Puzzle has no
 * fixed shape players could learn.
 */
export const GENERATOR_DEFAULTS = {
  minAnswers: 8,
  maxAnswers: 100,
  /** At least this many answers at Triple Kill or better (the Gem counts). */
  minRareAnswers: 3,
  /** At most this many esports Prompts (Pro Player), since many players don't follow pro play. */
  maxEsports: 1,
  /**
   * A Template used on day D isn't used again on days D+1 .. D+noRepeatDays. If that leaves too few
   * Templates for a day, the window narrows for that day only.
   */
  noRepeatDays: 5,
  /**
   * Templates in one family (overlapping Answer Sets) never share a Puzzle. Across days the rule is soft,
   * since a hard gap empties the item pool: a Template whose sibling ran N days ago ranks as if it had
   * run N + familyCreditDays days ago itself.
   */
  familyCreditDays: 3,
  /**
   * Picking favours the Templates unused the longest. Each gets a random bonus of up to this many days,
   * so Templates picked together once don't keep coming back together.
   */
  jitterDays: 4,
} as const;

/** One dated Puzzle as the Builder writes it: server-only, Answer Sets included. */
export interface GeneratedPuzzle {
  puzzleDay: string;
  puzzleNumber: number;
  /** The game data patch the Answer Sets were built from. */
  dataVersion: string;
  prompts: BuiltPrompt[];
}

export interface GenerateInput {
  /** Puzzle Days (`YYYY-MM-DD`) to generate, in order. */
  dates: readonly string[];
  /** One built Prompt per approved Template. */
  prompts: readonly BuiltPrompt[];
  firstPuzzleDay: string;
  dataVersion: string;
  /** Template IDs already used on earlier Puzzle Days, for the no-repeat rule. */
  history?: Readonly<Record<string, readonly string[]>>;
  /** Hand-picked Template IDs for a Puzzle Day, used as given. */
  overrides?: Readonly<Record<string, readonly string[]>>;
  /** Each Template's families (`TemplateDefinition.families`); a Template left out has none. */
  families?: Readonly<Record<string, readonly string[]>>;
  noRepeatDays?: number;
  familyCreditDays?: number;
  jitterDays?: number;
  minAnswers?: number;
  maxAnswers?: number;
  minRareAnswers?: number;
  maxEsports?: number;
}

const RARE: ReadonlySet<Tier> = new Set(["triple-kill", "quadra-kill", "pentakill"]);

/**
 * Pick seven Templates per date under the generator constraints, favouring the Templates unused the
 * longest. Deterministic for the same dates, pool and history.
 */
export function generatePuzzles(input: GenerateInput): GeneratedPuzzle[] {
  const options = { ...GENERATOR_DEFAULTS, ...definedOnly(input) };
  const byId = new Map(input.prompts.map((p) => [p.templateId, p]));
  const used = new Map(Object.entries(input.history ?? {}));
  const familiesOf = (id: string) => input.families?.[id] ?? [];

  return input.dates.map((day) => {
    const override = input.overrides?.[day];
    const prompts = override
      ? override.map((id) => lookup(byId, id, day))
      : pick(day, input.prompts, used, familiesOf, options);
    used.set(day, prompts.map((p) => p.templateId));
    return {
      puzzleDay: day,
      puzzleNumber: puzzleNumberOf(day, input.firstPuzzleDay),
      dataVersion: input.dataVersion,
      prompts,
    };
  });
}

function pick(
  day: string,
  candidates: readonly BuiltPrompt[],
  used: ReadonlyMap<string, readonly string[]>,
  familiesOf: (templateId: string) => readonly string[],
  options: typeof GENERATOR_DEFAULTS,
): BuiltPrompt[] {
  // Days since each Template was last used, counting only Puzzle Days before this one.
  const age = new Map<string, number>();
  for (const [usedDay, ids] of used) {
    const back = daysBetween(usedDay, day);
    if (back <= 0) continue;
    for (const id of ids) age.set(id, Math.min(back, age.get(id) ?? Infinity));
  }
  const familyAge = new Map<string, number>();
  for (const [id, back] of age) {
    for (const f of familiesOf(id)) familyAge.set(f, Math.min(back, familyAge.get(f) ?? Infinity));
  }
  const staleness = (id: string) =>
    Math.min(age.get(id) ?? Infinity, ...familiesOf(id).map((f) => (familyAge.get(f) ?? Infinity) + options.familyCreditDays));

  // If the full no-repeat window leaves too few Templates to meet the other constraints, narrow it
  // one day at a time for this day only, so a tight pool repeats a little sooner instead of failing.
  let eligibleCount = 0;
  for (let window = options.noRepeatDays; window >= 1; window--) {
    const random = rng(seedOf(day));
    const eligible = candidates.filter((p) => {
      const tiers = Object.values(p.answerSet);
      return (
        (age.get(p.templateId) ?? Infinity) > window &&
        tiers.length >= options.minAnswers &&
        tiers.length <= options.maxAnswers &&
        tiers.filter((t) => RARE.has(t)).length >= options.minRareAnswers
      );
    });
    eligibleCount = eligible.length;
    const chosen = choose(eligible, staleness, familiesOf, random, options);
    // Shuffle the seven so the Prompt order doesn't follow staleness.
    if (chosen.length === PROMPTS_PER_PUZZLE) return shuffle(chosen, random);
  }
  throw new Error(
    `${day}: fewer than ${PROMPTS_PER_PUZZLE} Prompts meet the generator constraints even with a 1-day no-repeat ` +
      `window (${eligibleCount} eligible Templates). Add Templates or override the day.`,
  );
}

/** Greedily take the stalest Templates that fit the esports and family limits. */
function choose(
  eligible: readonly BuiltPrompt[],
  staleness: (templateId: string) => number,
  familiesOf: (templateId: string) => readonly string[],
  random: () => number,
  options: typeof GENERATOR_DEFAULTS,
): BuiltPrompt[] {
  // Longest unused first (never used counts as a long time ago; a recent sibling counts against it),
  // with a seeded bonus so ties and near-ties vary from day to day.
  const NEVER = 10_000;
  const ranked = eligible
    .map((p) => ({ p, score: Math.min(staleness(p.templateId), NEVER) + random() * options.jitterDays }))
    .sort((a, b) => b.score - a.score)
    .map(({ p }) => p);

  const chosen: BuiltPrompt[] = [];
  const familiesToday = new Set<string>();
  let esports = 0;
  for (const p of ranked) {
    if (chosen.length === PROMPTS_PER_PUZZLE) break;
    const families = familiesOf(p.templateId);
    if (families.some((f) => familiesToday.has(f))) continue;
    const isEsports = ESPORTS_ANSWER_TYPES.has(p.answerType);
    if (isEsports && esports >= options.maxEsports) continue;
    if (isEsports) esports++;
    families.forEach((f) => familiesToday.add(f));
    chosen.push(p);
  }
  return chosen;
}

function lookup(byId: ReadonlyMap<string, BuiltPrompt>, id: string, day: string): BuiltPrompt {
  const prompt = byId.get(id);
  if (!prompt) throw new Error(`${day}: override names unknown Template "${id}"`);
  return prompt;
}

function definedOnly(input: GenerateInput): Partial<typeof GENERATOR_DEFAULTS> {
  const { noRepeatDays, familyCreditDays, jitterDays, minAnswers, maxAnswers, minRareAnswers, maxEsports } = input;
  const all = { noRepeatDays, familyCreditDays, jitterDays, minAnswers, maxAnswers, minRareAnswers, maxEsports };
  return Object.fromEntries(Object.entries(all).filter(([, v]) => v !== undefined));
}

/** FNV-1a hash of the date, as a PRNG seed. */
function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** mulberry32: a seeded PRNG, so a date always draws the same numbers. */
function rng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates with a seeded PRNG. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
