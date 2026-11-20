import { describe, expect, it } from "vitest";
import { entityRegistry } from "@/content/game-data";
import { gameDataSnapshot } from "@/content/game-data/snapshot-data";
import overlayJson from "@/content/overlay/champions.json";
import templatesJson from "@/content/templates/templates.json";
import { answerSetOf, type BuilderInputs, type ChampionMetaOverlay, type TemplateDefinition } from "./index";

/** The committed content: real snapshot, overlay and Templates. */
const overlay = overlayJson as ChampionMetaOverlay;
const templates = templatesJson as TemplateDefinition[];
const inputs: BuilderInputs = { snapshot: gameDataSnapshot, overlay };
const template = (id: string) => templates.find((t) => t.id === id)!;
const names = (ids: string[]) => {
  const byId = new Map(entityRegistry.map((e) => [e.id, e.name]));
  return ids.map((id) => byId.get(id));
};

describe("champion meta overlay", () => {
  it("covers region and Yordle for every champion, each fact with a source and patch", () => {
    for (const champion of gameDataSnapshot.champions) {
      const meta = overlay.champions[champion.id];
      expect(meta, champion.id).toBeDefined();
      for (const fact of [meta.region, meta.yordle]) {
        expect(fact.source, champion.id).toMatch(/^https:\/\//);
        expect(fact.patch, champion.id).toMatch(/^\d+\.\d+$/);
      }
    }
  });
});

describe("Templates on the committed data", () => {
  it("are unique and well-formed", () => {
    expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length);
    for (const t of templates) expect(t.text && t.rule, t.id).toBeTruthy();
  });

  it("champions from Bandle City", () => {
    expect(names(answerSetOf(template("champions-region-bandle-city"), inputs)).sort()).toEqual([
      "Corki",
      "Lulu",
      "Rumble",
      "Teemo",
      "Tristana",
      "Veigar",
      "Yuumi",
    ]);
  });

  it("Yordles include Gnar and Kled but not Yuumi", () => {
    const yordles = names(answerSetOf(template("champions-yordle"), inputs));
    expect(yordles).toContain("Gnar");
    expect(yordles).toContain("Kled");
    expect(yordles).not.toContain("Yuumi");
    expect(yordles).toHaveLength(14);
  });

  it("items that give Magic Resist", () => {
    const items = names(answerSetOf(template("items-magic-resist"), inputs));
    expect(items).toEqual(expect.arrayContaining(["Negatron Cloak", "Mercury's Treads", "Spirit Visage", "Kaenic Rookern"]));
    expect(items).not.toContain("Long Sword");
  });

  it('"Dragon" skins include Dragonslayer Xin Zhao, Dragonblade Talon and Obsidian Dragon Sett', () => {
    const skins = names(answerSetOf(template("skins-dragon"), inputs));
    expect(skins).toEqual(
      expect.arrayContaining(["Dragonslayer Xin Zhao", "Dragonblade Talon", "Obsidian Dragon Sett"]),
    );
  });
});
