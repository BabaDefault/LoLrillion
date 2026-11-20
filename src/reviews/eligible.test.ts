import { describe, expect, it } from "vitest";
import { puzzleTemplates, type ApprovedReview } from "./index";

const approved = (templateId: string): ApprovedReview => ({
  templateId,
  dataVersion: "16.22.1",
  answerSet: ["champion:Teemo"],
  typicality: {},
  tooClever: [],
  gem: "champion:Teemo",
});

describe("Templates eligible for new Puzzles", () => {
  const templates = [{ id: "yordles" }, { id: "bandle" }, { id: "mr" }];
  const reviews = { yordles: approved("yordles"), mr: approved("mr") };

  it("are only the approved Templates by default", () => {
    expect(puzzleTemplates(templates, reviews).map((t) => t.id)).toEqual(["yordles", "mr"]);
  });

  it("are every Template when unreviewed ones are explicitly included", () => {
    expect(puzzleTemplates(templates, reviews, { includeUnreviewed: true }).map((t) => t.id)).toEqual([
      "yordles",
      "bandle",
      "mr",
    ]);
  });
});
