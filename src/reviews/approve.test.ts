import { describe, expect, it } from "vitest";
import { approveProposal, checkApprovedReview, type ApprovedReview, type ReviewProposal } from "./index";

const proposal: ReviewProposal = {
  templateId: "champions-yordle",
  dataVersion: "16.23.1",
  answerSet: ["champion:Teemo", "champion:Kled", "champion:Gnar"],
  missing: [{ entity: "Veigar", why: "Is he missing?" }],
  disputable: [],
  wording: [],
  aliases: [],
  fun: { verdict: "ok", why: "Fine." },
  typicality: {
    "champion:Teemo": { value: 0.9, why: "a" },
    "champion:Kled": { value: 0.2, why: "b" },
    "champion:Gnar": { value: 0.4, why: "c" },
  },
  tooClever: [{ entity: "champion:Gnar", why: "d" }],
  gemCandidates: [
    { entity: "champion:Kled", why: "e" },
    { entity: "champion:Teemo", why: "f" },
    { entity: "champion:Gnar", why: "g" },
  ],
};

describe("approving a proposal", () => {
  it("drafts the approved file: Typicality values, the Too Clever set, the first Gem candidate and the sorted Answer Set", () => {
    expect(approveProposal(proposal)).toEqual({
      templateId: "champions-yordle",
      dataVersion: "16.23.1",
      answerSet: ["champion:Gnar", "champion:Kled", "champion:Teemo"],
      typicality: { "champion:Teemo": 0.9, "champion:Kled": 0.2, "champion:Gnar": 0.4 },
      tooClever: ["champion:Gnar"],
      gem: "champion:Kled",
    });
  });
});

describe("approved review check", () => {
  const review: ApprovedReview = approveProposal(proposal);

  it("accepts a consistent review", () => {
    expect(checkApprovedReview(review)).toEqual([]);
  });

  it("rejects a Gem that is Too Clever, and Typicality out of range", () => {
    const bad = { ...review, gem: "champion:Gnar", typicality: { "champion:Teemo": -0.1 } };
    const problems = checkApprovedReview(bad).join("\n");
    expect(problems).toMatch(/Gem champion:Gnar.*Too Clever/);
    expect(problems).toMatch(/champion:Teemo.*between 0 and 1/);
  });

  it("rejects a Gem with no approved Typicality, since its obscurity can't be judged", () => {
    const { "champion:Kled": _, ...typicality } = review.typicality;
    expect(checkApprovedReview({ ...review, typicality }).join("\n")).toMatch(/Gem champion:Kled has no Typicality/);
  });

  it("rejects a Gem whose Typicality is above 0.25, and accepts one at exactly 0.25", () => {
    const tooCommon = { ...review, typicality: { ...review.typicality, "champion:Kled": 0.3 } };
    expect(checkApprovedReview(tooCommon).join("\n")).toMatch(/Gem champion:Kled has Typicality 0\.3, above 0\.25/);
    const atLimit = { ...review, typicality: { ...review.typicality, "champion:Kled": 0.25 } };
    expect(checkApprovedReview(atLimit)).toEqual([]);
  });

  it("rejects a Gem in the likeliest half of the Answer Set by Typicality, leaving Too Clever picks out of the ranking", () => {
    const wide: ApprovedReview = {
      ...review,
      answerSet: ["champion:Corki", "champion:Gnar", "champion:Kled", "champion:Lulu", "champion:Teemo", "champion:Vex"],
      typicality: {
        "champion:Teemo": 0.9,
        "champion:Corki": 0.5,
        "champion:Gnar": 0.4,
        "champion:Kled": 0.2,
        "champion:Vex": 0.1,
        "champion:Lulu": 0.05,
      },
      tooClever: ["champion:Corki", "champion:Gnar"],
      gem: "champion:Kled",
    };
    // Ranked without the Too Clever picks: Teemo, Kled, Vex, Lulu. Kled is 2nd of 4.
    expect(checkApprovedReview(wide).join("\n")).toMatch(/Gem champion:Kled is 2nd of 4 .*likeliest half/);
    expect(checkApprovedReview({ ...wide, gem: "champion:Vex" })).toEqual([]);
  });

  it("checks picks against the Answer Set it was approved on (drift since then is the review queue's job)", () => {
    const problems = checkApprovedReview({ ...review, gem: "champion:Veigar", tooClever: ["champion:Lulu"] }).join("\n");
    expect(problems).toMatch(/Gem champion:Veigar/);
    expect(problems).toMatch(/Too Clever champion:Lulu/);
  });
});
