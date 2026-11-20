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

  it("checks picks against the Answer Set it was approved on (drift since then is the review queue's job)", () => {
    const problems = checkApprovedReview({ ...review, gem: "champion:Veigar", tooClever: ["champion:Lulu"] }).join("\n");
    expect(problems).toMatch(/Gem champion:Veigar/);
    expect(problems).toMatch(/Too Clever champion:Lulu/);
  });
});
