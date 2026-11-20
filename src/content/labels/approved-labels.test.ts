import { describe, expect, it } from "vitest";
import { gameDataSnapshot } from "@/content/game-data/snapshot-data";
import { BORROWED_ABILITIES, entitiesWithTerm, invalidLabels, MECHANICS_TERMS } from "@/labels";
import { approvedLabels } from "./index";

describe("approved mechanics labels", () => {
  it("all quote the committed snapshot word for word", () => {
    expect(invalidLabels(approvedLabels, gameDataSnapshot)).toEqual([]);
  });

  it("have at least one Entity for every defined term", () => {
    for (const term of MECHANICS_TERMS) {
      expect(entitiesWithTerm(approvedLabels, term.id), term.id).not.toEqual([]);
    }
  });

  it("Kai'Sa is invisible", () => {
    expect(entitiesWithTerm(approvedLabels, "invisible")).toContain("champion:Kaisa");
  });

  it("Sylas, Viego and Neeko don't count for stolen or copied abilities", () => {
    const cited = approvedLabels.filter((l) =>
      BORROWED_ABILITIES.some((b) => b.entityId === l.entityId && b.ability === l.ability),
    );
    expect(cited).toEqual([]);
    // Each can steal or borrow an enemy's ultimate, but none has a global ult of their own.
    const globalUlts = entitiesWithTerm(approvedLabels, "global-ult");
    expect(globalUlts).not.toContain("champion:Sylas");
    expect(globalUlts).not.toContain("champion:Viego");
    expect(globalUlts).not.toContain("champion:Neeko");
    // Sylas's E pulls himself to the enemy: a dash, not a pull.
    expect(entitiesWithTerm(approvedLabels, "pull")).not.toContain("champion:Sylas");
  });

  it("Ashe, Ezreal and Draven have global ults, from in-game behaviour the text never states", () => {
    expect(entitiesWithTerm(approvedLabels, "global-ult")).toEqual(
      expect.arrayContaining(["champion:Ashe", "champion:Ezreal", "champion:Draven"]),
    );
  });

  it("an in-game label always says what the game does", () => {
    for (const label of approvedLabels) {
      if ("inGame" in label) expect(label.inGame?.trim(), label.entityId).toBeTruthy();
    }
  });

  it("Aurora is not a pull champion", () => {
    expect(entitiesWithTerm(approvedLabels, "pull")).not.toContain("champion:Aurora");
  });

  it("Gnar is not a pull", () => {
    expect(entitiesWithTerm(approvedLabels, "pull")).not.toContain("champion:Gnar");
  });

  it("pull is still populated by real hooks", () => {
    expect(entitiesWithTerm(approvedLabels, "pull")).toEqual(
      expect.arrayContaining(["champion:Blitzcrank", "champion:Thresh"]),
    );
  });
});
