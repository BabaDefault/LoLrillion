import { describe, expect, it } from "vitest";
import { entityRegistry } from "@/content/game-data";
import { traitDefinition, TRAITS } from "@/traits";
import { approvedTraits } from "./index";

describe("approved curated traits", () => {
  const registry = new Map(entityRegistry.map((e) => [e.id, e]));

  it("each names a defined trait and a registry Entity of the trait's Answer Type, with a reason", () => {
    for (const t of approvedTraits) {
      const definition = traitDefinition(t.trait);
      expect(definition, `${t.entityId} ${t.trait}`).toBeDefined();
      expect(registry.get(t.entityId)?.answerType, `${t.entityId} ${t.trait}`).toBe(definition?.answerType);
      expect(t.why.trim(), `${t.entityId} ${t.trait}`).not.toBe("");
    }
  });

  it("approve each Entity once per trait", () => {
    const keys = approvedTraits.map((t) => `${t.entityId} ${t.trait}`);
    expect(keys.length - new Set(keys).size).toBe(0);
  });

  it("every defined trait has approvals", () => {
    for (const { id } of TRAITS) expect(approvedTraits.some((t) => t.trait === id), id).toBe(true);
  });
});
