import { describe, expect, it } from "vitest";
import { esportsSnapshot } from "@/content/esports";
import { entityRegistry } from "@/content/game-data";
import { gameDataSnapshot } from "@/content/game-data/snapshot-data";
import templatesJson from "@/content/templates/templates.json";
import { approvedLabels } from "@/content/labels";
import { approvedTraits } from "@/content/traits";
import { mechanicsTerm } from "@/labels";
import { traitDefinition } from "@/traits";
import { addDays, ESPORTS_ANSWER_TYPES } from "@/engine";
import { readGuess } from "@/engine/resolve";
import {
  answerSetOf,
  buildPrompt,
  generatePuzzles,
  GENERATOR_DEFAULTS,
  PROMPTS_PER_PUZZLE,
  type BuilderInputs,
  type TemplateDefinition,
  type TemplateFilter,
} from "./index";

/** The committed content: real snapshots and Templates. */
const templates = templatesJson as TemplateDefinition[];
const inputs: BuilderInputs = { snapshot: gameDataSnapshot, esports: esportsSnapshot, traits: approvedTraits };
const template = (id: string) => templates.find((t) => t.id === id)!;
const names = (ids: string[]) => {
  const byId = new Map(entityRegistry.map((e) => [e.id, e.name]));
  return ids.map((id) => byId.get(id));
};

describe("Templates on the committed data", () => {
  it("are unique and well-formed", () => {
    expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length);
    for (const t of templates) expect(t.text && t.rule, t.id).toBeTruthy();
  });

  it("kit Templates use a defined mechanics term and show its shared definition as the Rule", () => {
    for (const t of templates) {
      if (t.filter.kind !== "champion-label") continue;
      expect(t.rule, t.id).toBe(mechanicsTerm(t.filter.term)?.definition);
    }
  });

  it("trait Templates use a defined trait of their Answer Type and show its definition as the Rule", () => {
    for (const t of templates) {
      if (t.filter.kind !== "trait") continue;
      const trait = traitDefinition(t.filter.trait);
      expect(trait?.answerType, t.id).toBe(t.answerType);
      expect(t.rule, t.id).toBe(trait?.definition);
    }
  });

  it("name Templates read the official name: apostrophes, exact word count, letters anywhere, letter count across words", () => {
    const withLabels = { ...inputs, labels: approvedLabels };
    expect(names(answerSetOf(template("champions-apostrophe"), withLabels))).toEqual(expect.arrayContaining(["K'Sante", "Kai'Sa"]));
    const twoWords = names(answerSetOf(template("champions-two-word-name"), withLabels));
    expect(twoWords).toEqual(expect.arrayContaining(["Renata Glasc", "Dr. Mundo", "Jarvan IV"]));
    expect(twoWords).not.toContain("Nunu & Willump");
    expect(names(answerSetOf(template("champions-z-or-x"), withLabels))).toEqual(expect.arrayContaining(["Blitzcrank", "Malzahar", "Ezreal"]));
    const long = names(answerSetOf(template("champions-long-name"), withLabels));
    expect(long).toEqual(expect.arrayContaining(["Tryndamere", "Cassiopeia", "Twisted Fate"]));
    expect(long).not.toContain("Wukong");
    expect(names(answerSetOf(template("champions-vowel-start"), withLabels))).toEqual(expect.arrayContaining(["Udyr", "Urgot", "Olaf"]));
    expect(names(answerSetOf(template("champions-double-letter"), withLabels))).toEqual(expect.arrayContaining(["Aatrox", "Kassadin", "Lee Sin"]));
  });

  it("champions with approved labels: Kai'Sa is invisible", () => {
    const invisible = answerSetOf(template("champions-invisible"), { ...inputs, labels: approvedLabels });
    expect(invisible).toContain("champion:Kaisa");
  });

  it("items that give Magic Resist", () => {
    const items = names(answerSetOf(template("items-magic-resist"), inputs));
    expect(items).toEqual(expect.arrayContaining(["Negatron Cloak", "Mercury's Treads", "Spirit Visage", "Kaenic Rookern"]));
    expect(items).not.toContain("Long Sword");
  });

  it("item stats read from the tooltip add only Yun Tal Wildarrows (crit), beyond Data Dragon's stats map", () => {
    const added: Record<string, (string | undefined)[]> = {};
    for (const t of templates) {
      if (t.filter.kind !== "item-stat") continue;
      const stat = t.filter.stat;
      if (!gameDataSnapshot.items.some((i) => stat in i.stats)) continue; // tooltip-only stat
      const inStatsMap = new Set(
        gameDataSnapshot.items.filter((i) => (i.stats[stat] ?? 0) > 0).map((i) => `item:${i.id}`),
      );
      const extra = answerSetOf(t, inputs).filter((id) => !inStatsMap.has(id));
      if (extra.length) added[t.id] = names(extra);
    }
    expect(added).toEqual({ "items-crit": ["Yun Tal Wildarrows"] });
  });

  it("no lore Templates: kit labels, range, names, item stats, skin counts, esports, visual traits, and combinations of them", () => {
    const kinds = (f: TemplateFilter): string[] => (f.kind === "all" ? [f.kind, ...f.of.flatMap(kinds)] : [f.kind]);
    const used = new Set(templates.flatMap((t) => kinds(t.filter)));
    expect([...used].sort()).toEqual([
      "all",
      "champion-label",
      "champion-name-length",
      "champion-name-pattern",
      "champion-range",
      "champion-skin-count",
      "champion-skin-name-word",
      "item-stat",
      "trait",
      "worlds-winner",
    ]);
  });

  it("every Template's Answer Set fits the generator's size range", () => {
    const withLabels = { ...inputs, labels: approvedLabels };
    for (const t of templates) {
      const size = answerSetOf(t, withLabels).length;
      expect(size, t.id).toBeGreaterThanOrEqual(GENERATOR_DEFAULTS.minAnswers);
      expect(size, t.id).toBeLessThanOrEqual(GENERATOR_DEFAULTS.maxAnswers);
    }
  });

  it("combined filters keep only what every part selects: ranged champions who can become invisible", () => {
    const set = names(answerSetOf(template("champions-ranged-invisible"), { ...inputs, labels: approvedLabels }));
    expect(set).toEqual(expect.arrayContaining(["Twitch", "Vayne", "Kai'Sa"]));
    expect(set).not.toContain("Evelynn"); // melee
    expect(set).not.toContain("Jinx"); // ranged, never invisible
  });

  it("champion range uses the base form: Kayle and Jayce melee, Nidalee ranged", () => {
    const melee = names(answerSetOf({ ...template("champions-melee-pull"), filter: { kind: "champion-range", ranged: false } }, inputs));
    expect(melee).toEqual(expect.arrayContaining(["Kayle", "Jayce", "Garen"]));
    expect(melee).not.toContain("Nidalee");
    expect(melee).not.toContain("Ashe");
  });

  it("items with two stats need both", () => {
    const set = names(answerSetOf(template("items-armor-health"), inputs));
    expect(set).toEqual(expect.arrayContaining(["Sunfire Aegis", "Randuin's Omen"]));
    expect(set).not.toContain("Warmog's Armor"); // Health only
    expect(set).not.toContain("Chain Vest"); // Armor only
  });

  it("build paths are one step: Kindlegem builds into Spirit Visage, not into what Spirit Visage builds into", () => {
    const fromKindlegem = { ...template("items-armor"), filter: { kind: "item-builds-from", item: "3067" } } as TemplateDefinition;
    const set = names(answerSetOf(fromKindlegem, inputs));
    expect(set).toEqual(expect.arrayContaining(["Spirit Visage", "Locket of the Iron Solari"]));
    expect(set).not.toContain("Kindlegem");
    expect(set).not.toContain("Ruby Crystal");
  });

  it("Worlds winners: every winning roster's players, in the generator's size range, each a registry Entity", () => {
    const winners = answerSetOf(template("players-worlds-winners"), inputs);
    expect(winners.length).toBeGreaterThanOrEqual(GENERATOR_DEFAULTS.minAnswers);
    expect(winners.length).toBeLessThanOrEqual(GENERATOR_DEFAULTS.maxAnswers);
    expect(names(winners)).toEqual(expect.arrayContaining(["Faker", "xPeke", "Deft"]));
    expect(names(winners)).not.toContain(undefined);
    for (const w of esportsSnapshot.worldsWins) expect(w.players.length, `Worlds ${w.year}`).toBeGreaterThanOrEqual(5);
  });

  it("a former IGN reads as the same pro player; a surname-style ID does not", () => {
    expect(readGuess("Dean", "pro-player", entityRegistry)).toMatchObject({ kind: "match", entity: { name: "Zeka" } });
    expect(readGuess("PARK", "pro-player", entityRegistry)).not.toMatchObject({ kind: "match" });
  });

  it("knows Worlds players who never won (decoys), outside the Worlds winners Answer Set", () => {
    const uzi = readGuess("Uzi", "pro-player", entityRegistry);
    expect(uzi).toMatchObject({ kind: "match", entity: { name: "Uzi" } });
    const winners = answerSetOf(template("players-worlds-winners"), inputs);
    expect(winners).not.toContain(uzi.kind === "match" ? uzi.entity.id : "");
  });

  it("skin counts leave out the base skin: Miss Fortune has 18+, Smolder has five or fewer", () => {
    const many = names(answerSetOf(template("champions-many-skins"), inputs));
    const few = names(answerSetOf(template("champions-few-skins"), inputs));
    expect(many).toEqual(expect.arrayContaining(["Miss Fortune", "Ezreal", "Lux"]));
    expect(few).toEqual(expect.arrayContaining(["Smolder", "Hwei", "Mel"]));
    expect(many.filter((n) => few.includes(n))).toEqual([]);
  });

  it("Prestige skins count for their champion", () => {
    expect(names(answerSetOf(template("champions-prestige-skin"), inputs))).toEqual(
      expect.arrayContaining(["Kai'Sa", "Ahri"]),
    );
  });
});

describe("generator on the committed Templates", () => {
  // Every Template with default reviews and the approved labels: what `puzzles:build --include-unreviewed` uses.
  // Only 22 gameplay Templates remain and few kit labels are approved yet, so the default 3-day no-repeat
  // window (28 distinct Templates) can't be filled; 2 days (21) can. Every other constraint is the default.
  const NO_REPEAT_DAYS = 2;
  const prompts = templates.map((t) => buildPrompt(t, { ...inputs, labels: approvedLabels }));
  const days = Array.from({ length: 28 }, (_, i) => addDays("2027-01-01", i));

  it("fills four weeks of Puzzles: Answer Set sizes, rare answers and the esports limit", () => {
    const puzzles = generatePuzzles({
      dates: days,
      prompts,
      firstPuzzleDay: "2027-01-01",
      dataVersion: "test",
      noRepeatDays: NO_REPEAT_DAYS,
    });
    expect(puzzles.map((p) => p.puzzleDay)).toEqual(days);
    for (const puzzle of puzzles) {
      expect(puzzle.prompts, puzzle.puzzleDay).toHaveLength(PROMPTS_PER_PUZZLE);
      for (const p of puzzle.prompts) {
        const size = Object.keys(p.answerSet).length;
        expect(size, p.templateId).toBeGreaterThanOrEqual(GENERATOR_DEFAULTS.minAnswers);
        expect(size, p.templateId).toBeLessThanOrEqual(GENERATOR_DEFAULTS.maxAnswers);
        const rare = Object.values(p.answerSet).filter((t) => ["triple-kill", "quadra-kill", "pentakill"].includes(t));
        expect(rare.length, p.templateId).toBeGreaterThanOrEqual(GENERATOR_DEFAULTS.minRareAnswers);
      }
      const esports = puzzle.prompts.filter((p) => ESPORTS_ANSWER_TYPES.has(p.answerType));
      expect(esports.length, puzzle.puzzleDay).toBeLessThanOrEqual(GENERATOR_DEFAULTS.maxEsports);
    }
  });
});
