import { describe, expect, it } from "vitest";
import type { GameDataSnapshot, SnapshotChampion } from "@/content/game-data/snapshot";
import { changedChampions, taggedBaseline } from "./index";

function champion(id: string, qDescription: string): SnapshotChampion {
  return {
    id,
    key: 1,
    name: id,
    title: "",
    tags: [],
    attackRange: 125,
    abilities: [{ slot: "Q", name: "Q", description: qDescription, tooltip: "tip" }],
  };
}

function snapshot(patch: string, champions: SnapshotChampion[]): GameDataSnapshot {
  return { patch, champions, items: [], skins: [], skinLines: [], universes: [] };
}

describe("changed champions since the last tagging", () => {
  const before = snapshot("1.1.1", [champion("Aurora", "Aurora pulls."), champion("Gnar", "Gnar hops.")]);

  it("treats every champion as changed when nothing has been tagged yet", () => {
    expect(changedChampions(before, { patch: null, fingerprints: {} })).toEqual([
      "champion:Aurora",
      "champion:Gnar",
    ]);
  });

  it("lists only champions whose ability text changed, plus new champions", () => {
    const baseline = taggedBaseline(before);
    const after = snapshot("1.2.1", [
      champion("Aurora", "Aurora draws curses back."),
      champion("Gnar", "Gnar hops."),
      champion("Zaahen", "New."),
    ]);
    expect(changedChampions(after, baseline)).toEqual(["champion:Aurora", "champion:Zaahen"]);
  });

  it("ignores changes outside ability text", () => {
    const baseline = taggedBaseline(before);
    const retitled = snapshot("1.2.1", before.champions.map((c) => ({ ...c, title: "renamed" })));
    expect(changedChampions(retitled, baseline)).toEqual([]);
  });

  it("records the patch it was taken on", () => {
    expect(taggedBaseline(before).patch).toBe("1.1.1");
  });
});
