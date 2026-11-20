import { describe, expect, it } from "vitest";
import { entityRegistry } from "@/content/game-data";
import { gameDataSnapshot } from "@/content/game-data/snapshot-data";
import templatesJson from "@/content/templates/templates.json";
import { approvedLabels } from "@/content/labels";
import { mechanicsTerm } from "@/labels";
import { addDays } from "@/engine";
import {
  answerSetOf,
  buildPrompt,
  generatePuzzles,
  GENERATOR_DEFAULTS,
  PROMPTS_PER_PUZZLE,
  type BuilderInputs,
  type TemplateDefinition,
} from "./index";

/** The committed content: real snapshot and Templates. */
const templates = templatesJson as TemplateDefinition[];
const inputs: BuilderInputs = { snapshot: gameDataSnapshot };
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
      const inStatsMap = new Set(
        gameDataSnapshot.items.filter((i) => (i.stats[stat] ?? 0) > 0).map((i) => `item:${i.id}`),
      );
      const extra = answerSetOf(t, inputs).filter((id) => !inStatsMap.has(id));
      if (extra.length) added[t.id] = names(extra);
    }
    expect(added).toEqual({ "items-crit": ["Yun Tal Wildarrows"] });
  });

  it("only gameplay Templates: kit labels, name length, item stats and skin names", () => {
    const kinds = new Set(templates.map((t) => t.filter.kind));
    expect([...kinds].sort()).toEqual(["champion-label", "champion-name-length", "item-stat", "skin-name-word"]);
  });

  it('"Dragon" skins include Dragonslayer Xin Zhao, Dragonblade Talon and Obsidian Dragon Sett', () => {
    const skins = names(answerSetOf(template("skins-dragon"), inputs));
    expect(skins).toEqual(
      expect.arrayContaining(["Dragonslayer Xin Zhao", "Dragonblade Talon", "Obsidian Dragon Sett"]),
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

  it("fills four weeks of Puzzles: Answer Set sizes, rare answers and Answer Type mix", () => {
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
      const perType = new Map<string, number>();
      for (const p of puzzle.prompts) {
        perType.set(p.answerType, (perType.get(p.answerType) ?? 0) + 1);
        const size = Object.keys(p.answerSet).length;
        expect(size, p.templateId).toBeGreaterThanOrEqual(GENERATOR_DEFAULTS.minAnswers);
        expect(size, p.templateId).toBeLessThanOrEqual(GENERATOR_DEFAULTS.maxAnswers);
        const rare = Object.values(p.answerSet).filter((t) => ["triple-kill", "quadra-kill", "pentakill"].includes(t));
        expect(rare.length, p.templateId).toBeGreaterThanOrEqual(GENERATOR_DEFAULTS.minRareAnswers);
      }
      for (const [type, count] of perType) {
        expect(count, `${puzzle.puzzleDay} ${type}`).toBeLessThanOrEqual(GENERATOR_DEFAULTS.maxPerAnswerType);
      }
      expect(perType.size, puzzle.puzzleDay).toBeGreaterThan(1);
    }
  });
});
