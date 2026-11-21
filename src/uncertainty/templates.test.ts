import { describe, expect, it } from "vitest";
import type { ReviewProposal } from "@/reviews";
import { templateQueue } from "./index";

// Typicality spaced 0.1 or more apart, so no estimate is near a band edge or the Gem threshold.
const TYPICALITY: Record<string, number> = {
  "champion:A": 0.95,
  "champion:B": 0.85,
  "champion:C": 0.75,
  "champion:D": 0.65,
  "champion:E": 0.55,
  "champion:F": 0.45,
  "champion:G": 0.35,
  "champion:H": 0.12,
  "champion:I": 0.06,
  "champion:J": 0,
};

const proposal = (templateId: string, over: Partial<ReviewProposal> = {}): ReviewProposal => ({
  templateId,
  dataVersion: "16.24.1",
  answerSet: Object.keys(TYPICALITY),
  missing: [],
  disputable: [],
  wording: [],
  aliases: [],
  fun: { verdict: "fun", why: "" },
  typicality: Object.fromEntries(Object.entries(TYPICALITY).map(([id, value]) => [id, { value, why: "" }])),
  tooClever: [],
  gemCandidates: [
    { entity: "champion:I", why: "" },
    { entity: "champion:H", why: "" },
    { entity: "champion:J", why: "" },
  ],
  ...over,
});

const inputs = { patch: "16.24.1" };
const order = (queue: readonly { item: ReviewProposal }[]) => queue.map(({ item }) => item.templateId);

describe("Template review queue, most uncertain first", () => {
  it("ranks a Template with disputable entries above an otherwise identical one without", () => {
    const disputed = proposal("b-disputed", { disputable: [{ entity: "champion:C", why: "Players argue about it." }] });
    const queue = templateQueue([proposal("a-clean"), disputed], inputs);
    expect(order(queue)).toEqual(["b-disputed", "a-clean"]);
    expect(queue[0].reasons).toContain("disputable: champion:C (Players argue about it.)");
    expect(queue[1]).toMatchObject({ score: 0, reasons: [] });
  });

  it("raises uncertainty for each missing entry, so more missing Entities rank higher", () => {
    const one = proposal("a-one", { missing: [{ entity: "Yuumi", why: "Players think she fits." }] });
    const two = proposal("b-two", { missing: [...one.missing, { entity: "Kled", why: "Players count his Jousting (E) as a dash." }] });
    const queue = templateQueue([one, two], inputs);
    expect(order(queue)).toEqual(["b-two", "a-one"]);
    expect(queue[0].reasons).toEqual(["missing: Yuumi (Players think she fits.)", "missing: Kled (Players count his Jousting (E) as a dash.)"]);
  });

  it("raises uncertainty for Answer Set entries resting on a fact older than the current snapshot", () => {
    const staleFacts = {
      t: { "champion:B": "its dash label was checked on 16.23.1", "champion:Zed": "not in this Answer Set, so ignored" },
      other: { "champion:C": "another Template's fact, so ignored" },
    };
    const [ranked] = templateQueue([proposal("t")], { ...inputs, staleFacts });
    expect(ranked.reasons).toEqual(["stale fact: champion:B (its dash label was checked on 16.23.1)"]);
    expect(ranked.score).toBeGreaterThan(0);
  });

  it("ranks a proposal reviewed on an older patch than the current snapshot above a current one", () => {
    const old = proposal("b-old", { dataVersion: "16.23.1" });
    const queue = templateQueue([proposal("a-current"), old], inputs);
    expect(order(queue)).toEqual(["b-old", "a-current"]);
    expect(queue[0].reasons).toContain("reviewed on patch 16.23.1, older than the current snapshot 16.24.1");
  });

  it("compares an esports Template's review with the esports snapshot's date, not the game patch", () => {
    const old = proposal("b-old", { dataVersion: "esports:2026-11-01" });
    const current = proposal("a-current", { dataVersion: "esports:2026-11-21" });
    const queue = templateQueue([current, old], { ...inputs, esportsVersion: "esports:2026-11-21" });
    expect(order(queue)).toEqual(["b-old", "a-current"]);
    expect(queue[0].reasons).toContain("reviewed on esports:2026-11-01, older than the current snapshot esports:2026-11-21");
    expect(queue[1].reasons).toEqual([]);
  });

  it("ranks a Template whose Gem candidate's Typicality sits near the Gem threshold above one whose doesn't", () => {
    const nearThreshold = proposal("b-near");
    nearThreshold.typicality["champion:H"] = { value: 0.27, why: "" };
    const queue = templateQueue([proposal("a-far"), nearThreshold], inputs);
    expect(order(queue)).toEqual(["b-near", "a-far"]);
    expect(queue[0].reasons).toContain(
      "Gem candidate champion:H has Typicality 0.27, near the Gem threshold 0.25: a small change decides whether it can be the Gem",
    );
  });

  it("ranks a Template whose Gem candidate sits at the edge of the likeliest half above one whose doesn't", () => {
    // Five Entities above H (0.12): just enough to keep it out of the likeliest half; at 0.17 it would pass E.
    const atEdge = proposal("b-edge");
    atEdge.typicality["champion:E"] = { value: 0.14, why: "" };
    atEdge.typicality["champion:F"] = { value: 0.04, why: "" };
    atEdge.typicality["champion:G"] = { value: 0.03, why: "" };
    const queue = templateQueue([proposal("a-far"), atEdge], inputs);
    expect(order(queue)).toEqual(["b-edge", "a-far"]);
    expect(queue[0].reasons).toContain(
      "Gem candidate champion:H is 6th of 10 by Typicality, at the edge of the likeliest half of the Answer Set " +
        "(Too Clever left out): a small change decides whether it can be the Gem",
    );
  });

  it("flags a Gem candidate already in the likeliest half of the Answer Set", () => {
    const likely = proposal("t");
    likely.typicality["champion:I"] = { value: 0.2, why: "" };
    likely.typicality["champion:F"] = { value: 0.1, why: "" };
    likely.typicality["champion:G"] = { value: 0.09, why: "" };
    likely.typicality["champion:E"] = { value: 0.08, why: "" };
    const [ranked] = templateQueue([likely], inputs);
    expect(ranked.reasons).toContain(
      "Gem candidate champion:I is 5th of 10 by Typicality, in the likeliest half of the Answer Set " +
        "(Too Clever left out): it can't be the Gem",
    );
  });

  it("ranks a Template with Typicality estimates near a band edge above one without", () => {
    // Banded (Gem and Too Clever left out), A, B and C are Minion and D starts Kill: 0.75 vs 0.72 is a close call.
    const close = proposal("b-close");
    close.typicality["champion:D"] = { value: 0.72, why: "" };
    const queue = templateQueue([proposal("a-spread"), close], inputs);
    expect(order(queue)).toEqual(["b-close", "a-spread"]);
    expect(queue[0].reasons).toEqual([
      "near a band edge: champion:C (0.75, minion) and champion:D (0.72, kill) are within 0.05: a small change swaps their Tiers",
    ]);
  });
});
