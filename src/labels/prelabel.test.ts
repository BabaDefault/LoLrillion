import { describe, expect, it } from "vitest";
import { gameDataSnapshot } from "@/content/game-data/snapshot-data";
import { prelabel, validateLabel } from "./index";

describe("keyword pre-labelling", () => {
  const suggestions = prelabel(gameDataSnapshot);

  it("suggests Kai'Sa is invisible, with the matched word and its sentence", () => {
    expect(suggestions).toContainEqual({
      entityId: "champion:Kaisa",
      term: "invisible",
      ability: "E",
      sourceField: "tooltip",
      matched: "Invisible",
      quote: "Evolved: Kai'Sa also becomes Invisible for {{ e7 }} seconds.",
    });
  });

  it("suggests a pull for Blitzcrank's Rocket Grab", () => {
    expect(
      suggestions.some((s) => s.entityId === "champion:Blitzcrank" && s.term === "pull" && s.ability === "Q"),
    ).toBe(true);
  });

  it("only quotes text that passes the quote validator", () => {
    const invalid = suggestions.filter((s) => !validateLabel(s, gameDataSnapshot).ok);
    expect(invalid).toEqual([]);
  });

  it("never suggests from stolen or copied abilities", () => {
    expect(suggestions.filter((s) => s.entityId === "champion:Sylas" && s.ability === "R")).toEqual([]);
  });

  it("can be limited to some champions", () => {
    const onlyKaisa = prelabel(gameDataSnapshot, ["champion:Kaisa"]);
    expect(onlyKaisa.length).toBeGreaterThan(0);
    expect(onlyKaisa.every((s) => s.entityId === "champion:Kaisa")).toBe(true);
  });
});
