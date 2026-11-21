import { describe, expect, it } from "vitest";
import { approveProposal, checkApprovedReview, type ApprovedReview, type ReviewProposal } from "./index";

const proposal: ReviewProposal = {
  templateId: "champions-dash",
  dataVersion: "16.23.1",
  answerSet: ["champion:Yasuo", "champion:Rell", "champion:Kindred"],
  missing: [{ entity: "Annie", why: "Is he missing?" }],
  disputable: [],
  wording: [],
  aliases: [],
  fun: { verdict: "ok", why: "Fine." },
  typicality: {
    "champion:Yasuo": { value: 0.9, why: "a" },
    "champion:Rell": { value: 0.2, why: "b" },
    "champion:Kindred": { value: 0.4, why: "c" },
  },
  tooClever: [{ entity: "champion:Kindred", why: "d" }],
  gemCandidates: [
    { entity: "champion:Rell", why: "e" },
    { entity: "champion:Yasuo", why: "f" },
    { entity: "champion:Kindred", why: "g" },
  ],
};

describe("approving a proposal", () => {
  it("drafts the approved file: Typicality values, the Too Clever set, the first Gem candidate and the sorted Answer Set", () => {
    expect(approveProposal(proposal)).toEqual({
      templateId: "champions-dash",
      dataVersion: "16.23.1",
      answerSet: ["champion:Kindred", "champion:Rell", "champion:Yasuo"],
      typicality: { "champion:Yasuo": 0.9, "champion:Rell": 0.2, "champion:Kindred": 0.4 },
      tooClever: ["champion:Kindred"],
      gem: "champion:Rell",
    });
  });
});

describe("approved review check", () => {
  const review: ApprovedReview = approveProposal(proposal);

  it("accepts a consistent review", () => {
    expect(checkApprovedReview(review)).toEqual([]);
  });

  it("rejects a Gem that is Too Clever, and Typicality out of range", () => {
    const bad = { ...review, gem: "champion:Kindred", typicality: { "champion:Yasuo": -0.1 } };
    const problems = checkApprovedReview(bad).join("\n");
    expect(problems).toMatch(/Gem champion:Kindred.*Too Clever/);
    expect(problems).toMatch(/champion:Yasuo.*between 0 and 1/);
  });

  it("rejects a Gem with no approved Typicality, since its obscurity can't be judged", () => {
    const { "champion:Rell": _, ...typicality } = review.typicality;
    expect(checkApprovedReview({ ...review, typicality }).join("\n")).toMatch(/Gem champion:Rell has no Typicality/);
  });

  it("rejects a Gem whose Typicality is above 0.25, and accepts one at exactly 0.25", () => {
    const tooCommon = { ...review, typicality: { ...review.typicality, "champion:Rell": 0.3 } };
    expect(checkApprovedReview(tooCommon).join("\n")).toMatch(/Gem champion:Rell has Typicality 0\.3, above 0\.25/);
    const atLimit = { ...review, typicality: { ...review.typicality, "champion:Rell": 0.25 } };
    expect(checkApprovedReview(atLimit)).toEqual([]);
  });

  it("rejects a Gem in the likeliest half of the Answer Set by Typicality, leaving Too Clever picks out of the ranking", () => {
    const wide: ApprovedReview = {
      ...review,
      answerSet: ["champion:Corki", "champion:Kindred", "champion:Rell", "champion:Riven", "champion:Yasuo", "champion:Vex"],
      typicality: {
        "champion:Yasuo": 0.9,
        "champion:Corki": 0.5,
        "champion:Kindred": 0.4,
        "champion:Rell": 0.2,
        "champion:Vex": 0.1,
        "champion:Riven": 0.05,
      },
      tooClever: ["champion:Corki", "champion:Kindred"],
      gem: "champion:Rell",
    };
    // Ranked without the Too Clever picks: Yasuo, Rell, Vex, Riven. Rell is 2nd of 4.
    expect(checkApprovedReview(wide).join("\n")).toMatch(/Gem champion:Rell is 2nd of 4 .*likeliest half/);
    expect(checkApprovedReview({ ...wide, gem: "champion:Vex" })).toEqual([]);
  });

  it("checks picks against the Answer Set it was approved on (drift since then is the review queue's job)", () => {
    const problems = checkApprovedReview({ ...review, gem: "champion:Annie", tooClever: ["champion:Riven"] }).join("\n");
    expect(problems).toMatch(/Gem champion:Annie/);
    expect(problems).toMatch(/Too Clever champion:Riven/);
  });
});
