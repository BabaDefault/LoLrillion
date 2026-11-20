import { describe, expect, it } from "vitest";
import { checkProposal, type ReviewProposal } from "./index";

const answerSet = ["champion:Teemo", "champion:Tristana", "champion:Lulu", "champion:Gnar", "champion:Kled"];

const proposal = (overrides: Partial<ReviewProposal> = {}): ReviewProposal => ({
  templateId: "champions-yordle",
  dataVersion: "16.23.1",
  answerSet,
  missing: [],
  disputable: [{ entity: "champion:Gnar", why: "Mega Gnar is not small." }],
  wording: [],
  aliases: [],
  fun: { verdict: "fun", why: "Everyone knows a few; few know them all." },
  typicality: {
    "champion:Teemo": { value: 0.95, why: "The Yordle." },
    "champion:Tristana": { value: 0.6, why: "Classic." },
    "champion:Lulu": { value: 0.6, why: "Classic." },
    "champion:Gnar": { value: 0.3, why: "Forgotten." },
    "champion:Kled": { value: 0.2, why: "Forgotten." },
  },
  tooClever: [{ entity: "champion:Gnar", why: "The 'gotcha' Yordle everyone picks." }],
  gemCandidates: [
    { entity: "champion:Kled", why: "Rarely remembered as a Yordle." },
    { entity: "champion:Lulu", why: "" },
    { entity: "champion:Tristana", why: "x" },
  ],
  ...overrides,
});

describe("proposal check", () => {
  it("accepts a complete proposal for the current Answer Set", () => {
    const ok = proposal({ gemCandidates: proposal().gemCandidates.map((g) => ({ ...g, why: "reason" })) });
    expect(checkProposal(ok, answerSet)).toEqual([]);
  });

  it("rejects a proposal made on a different Answer Set", () => {
    const problems = checkProposal(proposal({ answerSet: answerSet.slice(1) }), answerSet);
    expect(problems.join("\n")).toMatch(/Answer Set/);
  });

  it("needs a Typicality between 0 and 1 for every Entity, and nothing outside the set", () => {
    const typicality = { ...proposal().typicality, "champion:Teemo": { value: 1.5, why: "x" }, "champion:Garen": { value: 0.1, why: "x" } };
    delete (typicality as Record<string, unknown>)["champion:Kled"];
    const problems = checkProposal(proposal({ typicality }), answerSet).join("\n");
    expect(problems).toMatch(/champion:Teemo/);
    expect(problems).toMatch(/champion:Garen/);
    expect(problems).toMatch(/champion:Kled/);
  });

  it("needs exactly three distinct Gem candidates from the Answer Set, none of them Too Clever, each with a reason", () => {
    const two = proposal({ gemCandidates: [{ entity: "champion:Kled", why: "a" }, { entity: "champion:Lulu", why: "b" }] });
    expect(checkProposal(two, answerSet).join("\n")).toMatch(/exactly 3 Gem candidates/);
    const problems = checkProposal(
      proposal({
        gemCandidates: [
          { entity: "champion:Gnar", why: "a" },
          { entity: "champion:Veigar", why: "b" },
          { entity: "champion:Lulu", why: "" },
        ],
      }),
      answerSet,
    ).join("\n");
    expect(problems).toMatch(/champion:Gnar.*Too Clever/);
    expect(problems).toMatch(/champion:Veigar/);
    expect(problems).toMatch(/champion:Lulu.*reason/);
  });

  it("Too Clever candidates must be in the Answer Set", () => {
    const problems = checkProposal(proposal({ tooClever: [{ entity: "champion:Veigar", why: "x" }], gemCandidates: [
      { entity: "champion:Kled", why: "a" }, { entity: "champion:Lulu", why: "b" }, { entity: "champion:Tristana", why: "c" },
    ] }), answerSet);
    expect(problems).toEqual(["Too Clever candidate champion:Veigar is not in the Answer Set"]);
  });
});
