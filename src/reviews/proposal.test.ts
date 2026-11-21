import { describe, expect, it } from "vitest";
import { checkProposal, type ReviewProposal } from "./index";

const answerSet = ["champion:Yasuo", "champion:Ahri", "champion:Riven", "champion:Kindred", "champion:Rell"];

const proposal = (overrides: Partial<ReviewProposal> = {}): ReviewProposal => ({
  templateId: "champions-dash",
  dataVersion: "16.23.1",
  answerSet,
  missing: [],
  disputable: [{ entity: "champion:Kindred", why: "Dance of Arrows is a short hop; some won't call it a dash." }],
  wording: [],
  aliases: [],
  fun: { verdict: "fun", why: "Everyone knows a few; few know them all." },
  typicality: {
    "champion:Yasuo": { value: 0.95, why: "The first dash anyone names." },
    "champion:Ahri": { value: 0.6, why: "Classic." },
    "champion:Riven": { value: 0.6, why: "Classic." },
    "champion:Kindred": { value: 0.3, why: "Forgotten." },
    "champion:Rell": { value: 0.2, why: "Forgotten." },
  },
  tooClever: [{ entity: "champion:Kindred", why: "The 'gotcha' dash everyone picks." }],
  gemCandidates: [
    { entity: "champion:Rell", why: "Rarely remembered as a dash." },
    { entity: "champion:Riven", why: "" },
    { entity: "champion:Ahri", why: "x" },
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
    const typicality = { ...proposal().typicality, "champion:Yasuo": { value: 1.5, why: "x" }, "champion:Garen": { value: 0.1, why: "x" } };
    delete (typicality as Record<string, unknown>)["champion:Rell"];
    const problems = checkProposal(proposal({ typicality }), answerSet).join("\n");
    expect(problems).toMatch(/champion:Yasuo/);
    expect(problems).toMatch(/champion:Garen/);
    expect(problems).toMatch(/champion:Rell/);
  });

  it("needs exactly three distinct Gem candidates from the Answer Set, none of them Too Clever, each with a reason", () => {
    const two = proposal({ gemCandidates: [{ entity: "champion:Rell", why: "a" }, { entity: "champion:Riven", why: "b" }] });
    expect(checkProposal(two, answerSet).join("\n")).toMatch(/exactly 3 Gem candidates/);
    const problems = checkProposal(
      proposal({
        gemCandidates: [
          { entity: "champion:Kindred", why: "a" },
          { entity: "champion:Annie", why: "b" },
          { entity: "champion:Riven", why: "" },
        ],
      }),
      answerSet,
    ).join("\n");
    expect(problems).toMatch(/champion:Kindred.*Too Clever/);
    expect(problems).toMatch(/champion:Annie/);
    expect(problems).toMatch(/champion:Riven.*reason/);
  });

  it("Too Clever candidates must be in the Answer Set", () => {
    const problems = checkProposal(proposal({ tooClever: [{ entity: "champion:Annie", why: "x" }], gemCandidates: [
      { entity: "champion:Rell", why: "a" }, { entity: "champion:Riven", why: "b" }, { entity: "champion:Ahri", why: "c" },
    ] }), answerSet);
    expect(problems).toEqual(["Too Clever candidate champion:Annie is not in the Answer Set"]);
  });
});
