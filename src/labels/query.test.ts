import { describe, expect, it } from "vitest";
import { entitiesWithTerm, type MechanicsLabel } from "./index";

const label = (entityId: string, term: string): MechanicsLabel => ({
  entityId,
  term,
  ability: "Q",
  quote: "x",
  sourceField: "description",
});

describe("entitiesWithTerm", () => {
  it("lists each labelled Entity once, in label order", () => {
    const labels = [
      label("champion:Thresh", "pull"),
      label("champion:Blitzcrank", "pull"),
      label("champion:Thresh", "pull"),
      label("champion:Thresh", "stun"),
    ];
    expect(entitiesWithTerm(labels, "pull")).toEqual(["champion:Thresh", "champion:Blitzcrank"]);
    expect(entitiesWithTerm(labels, "dash")).toEqual([]);
  });
});
