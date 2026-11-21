import { describe, expect, it } from "vitest";
import type { GameDataSnapshot } from "@/content/game-data/snapshot";
import { validateLabel } from "./index";

const snapshot = {
  patch: "test",
  champions: [
    {
      id: "Kaisa",
      key: 145,
      name: "Kai'Sa",
      title: "Daughter of the Void",
      tags: ["Marksman"],
      attackRange: 525,
      abilities: [
        { slot: "P", name: "Second Skin", description: "Kai'Sa's basic attacks stack Plasma. " },
        {
          slot: "E",
          name: "Supercharge",
          description: "Kai'Sa briefly increases her Move Speed.<br><br>Living Weapon: Supercharge is upgraded to briefly grant Invisibility. ",
          tooltip:
            "Kai'Sa supercharges.<br /><br /><keywordMajor>Evolved</keywordMajor>: Kai'Sa also becomes <keywordStealth>Invisible</keywordStealth> for {{ e7 }} seconds.",
        },
      ],
    },
    {
      id: "Sylas",
      key: 517,
      name: "Sylas",
      title: "the Unshackled",
      tags: ["Mage"],
      attackRange: 175,
      abilities: [
        { slot: "R", name: "Hijack", description: "Sylas steals the enemy's ultimate ability and can cast it freely. " },
      ],
    },
  ],
  items: [],
  skins: [],
  skinLines: [],
  universes: [],
} as GameDataSnapshot;

describe("validateLabel", () => {
  it("accepts a quote that appears word for word in the tag-stripped tooltip", () => {
    expect(
      validateLabel(
        {
          entityId: "champion:Kaisa",
          term: "invisible",
          ability: "E",
          quote: "Kai'Sa also becomes Invisible for {{ e7 }} seconds.",
          sourceField: "tooltip",
        },
        snapshot,
      ),
    ).toEqual({ ok: true });
  });

  it("accepts a quote spanning a line break in the description", () => {
    expect(
      validateLabel(
        {
          entityId: "champion:Kaisa",
          term: "invisible",
          ability: "E",
          quote: "Move Speed. Living Weapon: Supercharge is upgraded to briefly grant Invisibility.",
          sourceField: "description",
        },
        snapshot,
      ).ok,
    ).toBe(true);
  });

  it("rejects a made-up quote", () => {
    const result = validateLabel(
      {
        entityId: "champion:Kaisa",
        term: "invisible",
        ability: "E",
        quote: "Kai'Sa becomes Invisible for 2 seconds.",
        sourceField: "tooltip",
      },
      snapshot,
    );
    expect(result).toEqual({ ok: false, reason: "quote-not-found" });
  });

  it("rejects a real quote attributed to the wrong field or ability", () => {
    const quote = "Kai'Sa also becomes Invisible for {{ e7 }} seconds.";
    const base = { entityId: "champion:Kaisa", term: "invisible", quote } as const;
    expect(validateLabel({ ...base, ability: "E", sourceField: "description" }, snapshot).ok).toBe(false);
    expect(validateLabel({ ...base, ability: "P", sourceField: "tooltip" }, snapshot).ok).toBe(false);
  });

  it("rejects a quote whose case differs from the source", () => {
    const result = validateLabel(
      {
        entityId: "champion:Kaisa",
        term: "invisible",
        ability: "E",
        quote: "kai'sa also becomes invisible for {{ e7 }} seconds.",
        sourceField: "tooltip",
      },
      snapshot,
    );
    expect(result).toEqual({ ok: false, reason: "quote-not-found" });
  });

  it("rejects empty quotes, unknown terms and unknown entities", () => {
    const ok = {
      entityId: "champion:Kaisa",
      term: "invisible",
      ability: "E",
      quote: "Kai'Sa also becomes Invisible",
      sourceField: "tooltip",
    } as const;
    expect(validateLabel({ ...ok, quote: "  " }, snapshot)).toEqual({ ok: false, reason: "empty-quote" });
    expect(validateLabel({ ...ok, term: "flies" }, snapshot)).toEqual({ ok: false, reason: "unknown-term" });
    expect(validateLabel({ ...ok, entityId: "champion:Nobody" }, snapshot)).toEqual({
      ok: false,
      reason: "unknown-entity",
    });
  });

  it("rejects evidence from a stolen or copied ability (Sylas's Hijack)", () => {
    const result = validateLabel(
      {
        entityId: "champion:Sylas",
        term: "global-ult",
        ability: "R",
        quote: "Sylas steals the enemy's ultimate ability",
        sourceField: "description",
      },
      snapshot,
    );
    expect(result).toEqual({ ok: false, reason: "borrowed-ability" });
  });
});
