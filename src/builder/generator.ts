import { addDays, ESPORTS_ANSWER_TYPES, puzzleNumberOf, type Tier } from "@/engine";
import type { BuiltPrompt } from "./types";

export const PROMPTS_PER_PUZZLE = 7;

/** Default generator constraints (spec: Answer Sets of about 8-100, a few rare answers, a type mix, one esports Prompt at most). */
export const GENERATOR_DEFAULTS = {
  minAnswers: 8,
  maxAnswers: 100,
  /** At least this many answers at Triple Kill or better (the Gem counts). */
  minRareAnswers: 3,
  /** At most this many Prompts of one Answer Type, so every Puzzle mixes types. */
  maxPerAnswerType: 4,
  /** At most this many esports Prompts (Pro Player), since many players don't follow pro play. */
  maxEsports: 1,
  /** A Template used on day D isn't used again on days D+1 .. D+noRepeatDays. */
  noRepeatDays: 3,
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
  noRepeatDays?: number;
  minAnswers?: number;
  maxAnswers?: number;
  minRareAnswers?: number;
  maxPerAnswerType?: number;
  maxEsports?: number;
}

const RARE: ReadonlySet<Tier> = new Set(["triple-kill", "quadra-kill", "pentakill"]);

/** Pick seven Templates per date under the generator constraints. Deterministic per date. */
export function generatePuzzles(input: GenerateInput): GeneratedPuzzle[] {
  const options = { ...GENERATOR_DEFAULTS, ...definedOnly(input) };
  const byId = new Map(input.prompts.map((p) => [p.templateId, p]));
  const used = new Map(Object.entries(input.history ?? {}));

  return input.dates.map((day) => {
    const override = input.overrides?.[day];
    const prompts = override ? override.map((id) => lookup(byId, id, day)) : pick(day, input.prompts, used, options);
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
  options: typeof GENERATOR_DEFAULTS,
): BuiltPrompt[] {
  const recent = new Set<string>();
  for (let back = 1; back <= options.noRepeatDays; back++) {
    for (const id of used.get(addDays(day, -back)) ?? []) recent.add(id);
  }
  const eligible = candidates.filter((p) => {
    const tiers = Object.values(p.answerSet);
    return (
      !recent.has(p.templateId) &&
      tiers.length >= options.minAnswers &&
      tiers.length <= options.maxAnswers &&
      tiers.filter((t) => RARE.has(t)).length >= options.minRareAnswers
    );
  });

  const chosen: BuiltPrompt[] = [];
  const perType = new Map<string, number>();
  let esports = 0;
  for (const p of shuffle(eligible, seedOf(day))) {
    if (chosen.length === PROMPTS_PER_PUZZLE) break;
    const count = perType.get(p.answerType) ?? 0;
    if (count >= options.maxPerAnswerType) continue;
    const isEsports = ESPORTS_ANSWER_TYPES.has(p.answerType);
    if (isEsports && esports >= options.maxEsports) continue;
    if (isEsports) esports++;
    perType.set(p.answerType, count + 1);
    chosen.push(p);
  }
  if (chosen.length < PROMPTS_PER_PUZZLE) {
    throw new Error(
      `${day}: only ${chosen.length} of ${PROMPTS_PER_PUZZLE} Prompts meet the generator constraints ` +
        `(${eligible.length} eligible Templates). Add Templates, shorten noRepeatDays, or override the day.`,
    );
  }
  return chosen;
}

function lookup(byId: ReadonlyMap<string, BuiltPrompt>, id: string, day: string): BuiltPrompt {
  const prompt = byId.get(id);
  if (!prompt) throw new Error(`${day}: override names unknown Template "${id}"`);
  return prompt;
}

function definedOnly(input: GenerateInput): Partial<typeof GENERATOR_DEFAULTS> {
  const { noRepeatDays, minAnswers, maxAnswers, minRareAnswers, maxPerAnswerType, maxEsports } = input;
  const all = { noRepeatDays, minAnswers, maxAnswers, minRareAnswers, maxPerAnswerType, maxEsports };
  return Object.fromEntries(Object.entries(all).filter(([, v]) => v !== undefined));
}

/** FNV-1a hash of the date, as a PRNG seed. */
function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Fisher-Yates with mulberry32, so a date always shuffles the same way. */
function shuffle<T>(items: readonly T[], seed: number): T[] {
  let state = seed;
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
