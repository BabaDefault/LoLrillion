import { describe, expect, it } from "vitest";
import type { GameDataSnapshot } from "@/content/game-data/snapshot";
import type { MechanicsLabel } from "@/labels";
import { labelQueue } from "./index";

const snapshot: GameDataSnapshot = {
  patch: "16.24.1",
  champions: [
    {
      id: "Hopper",
      key: 1,
      name: "Hopper",
      title: "",
      tags: [],
      attackRange: 125,
      abilities: [
        { slot: "Q", name: "Hop", description: "Hopper hops forward.", tooltip: "Hopper dashes forward. Hopper bounds over a wall." },
      ],
    },
    {
      id: "Sneak",
      key: 2,
      name: "Sneak",
      title: "",
      tags: [],
      attackRange: 125,
      abilities: [{ slot: "Q", name: "Fade", description: "Sneak fades away.", tooltip: "Sneak fades away. Sneak becomes Invisible." }],
    },
  ],
  items: [],
  skins: [],
  skinLines: [],
  universes: [],
};

const label = (over: Partial<MechanicsLabel>): MechanicsLabel => ({
  entityId: "champion:Sneak",
  term: "invisible",
  ability: "Q",
  quote: "Sneak becomes Invisible.",
  sourceField: "tooltip",
  ...over,
});

const inputs = { snapshot, changed: [] as string[] };
const order = (labels: readonly { item: MechanicsLabel }[]) => labels.map(({ item }) => `${item.entityId} ${item.term}`);

describe("label review queue, most uncertain first", () => {
  it("ranks a label without pre-label keyword evidence above an otherwise identical label that has it", () => {
    // Neither quote has a keyword, but Sneak's ability text elsewhere says "Invisible"; Hopper's never does.
    const keywordElsewhere = label({ entityId: "champion:Sneak", quote: "Sneak fades away." });
    const noEvidence = label({ entityId: "champion:Hopper", quote: "Hopper bounds over a wall." });
    const { queue } = labelQueue([keywordElsewhere, noEvidence], inputs);
    expect(order(queue)).toEqual(["champion:Hopper invisible", "champion:Sneak invisible"]);
    expect(queue[0].reasons).toContain("no keyword evidence: the pre-labeller found no invisible keyword for champion:Hopper");
    expect(queue[1].reasons.join()).not.toContain("pre-labeller");
  });

  it("ranks a quote from the short description above the same quote from the tooltip", () => {
    const fromTooltip = label({ entityId: "champion:Sneak", quote: "Sneak fades away.", sourceField: "tooltip" });
    const fromDescription = label({ ...fromTooltip, sourceField: "description" });
    const { queue } = labelQueue([fromTooltip, fromDescription], inputs);
    expect(queue.map((q) => q.item.sourceField)).toEqual(["description", "tooltip"]);
    expect(queue[0].reasons).toContain("quoted from the short description, not the tooltip");
  });

  it("ranks a quote that doesn't contain the term's keyword above one that does", () => {
    const keywordQuote = label({ quote: "Sneak becomes Invisible." });
    const plainQuote = label({ quote: "Sneak fades away." });
    const { queue } = labelQueue([keywordQuote, plainQuote], inputs);
    expect(queue.map((q) => q.item.quote)).toEqual(["Sneak fades away.", "Sneak becomes Invisible."]);
    expect(queue[0].reasons).toContain("the quote has no invisible keyword");
    expect(queue[1]).toMatchObject({ score: 0, reasons: [] });
  });

  it("ranks a label for a borderline term (dash vs blink) above an otherwise equally certain one", () => {
    const invisible = label({ entityId: "champion:Sneak", term: "invisible", quote: "Sneak becomes Invisible." });
    const dash = label({ entityId: "champion:Hopper", term: "dash", quote: "Hopper dashes forward." });
    const { queue } = labelQueue([invisible, dash], inputs);
    expect(order(queue)).toEqual(["champion:Hopper dash", "champion:Sneak invisible"]);
    expect(queue[0].reasons).toContain("dash is a borderline term: dash vs blink or teleport");
  });

  it("ranks a label on a champion whose ability text changed this patch above an unchanged one", () => {
    const sneak = label({ entityId: "champion:Sneak", quote: "Sneak becomes Invisible." });
    const { queue } = labelQueue([sneak], { snapshot, changed: ["champion:Sneak"] });
    const unchanged = labelQueue([sneak], inputs).queue;
    expect(queue[0].score).toBeGreaterThan(unchanged[0].score);
    expect(queue[0].reasons).toContain("champion:Sneak's ability text changed this patch");
  });

  it("rejects labels whose quote fails the validator outright instead of ranking them", () => {
    const valid = label({ quote: "Sneak becomes Invisible." });
    const misquoted = label({ quote: "Sneak turns invisible." });
    const { queue, rejected } = labelQueue([valid, misquoted], inputs);
    expect(queue.map((q) => q.item)).toEqual([valid]);
    expect(rejected).toEqual([{ label: misquoted, reason: "quote-not-found" }]);
  });
});
