import { describe, expect, it } from "vitest";
import { puzzleTemplates, type ApprovedReview } from "./index";

const approved = (templateId: string): ApprovedReview => ({
  templateId,
  dataVersion: "16.22.1",
  answerSet: ["champion:Yasuo"],
  typicality: {},
  tooClever: [],
  gem: "champion:Yasuo",
});

describe("Templates eligible for new Puzzles", () => {
  const templates = [{ id: "dashes" }, { id: "pulls" }, { id: "mr" }];
  const reviews = { dashes: approved("dashes"), mr: approved("mr") };

  it("are only the approved Templates by default", () => {
    expect(puzzleTemplates(templates, reviews).map((t) => t.id)).toEqual(["dashes", "mr"]);
  });

  it("are every Template when unreviewed ones are explicitly included", () => {
    expect(puzzleTemplates(templates, reviews, { includeUnreviewed: true }).map((t) => t.id)).toEqual([
      "dashes",
      "pulls",
      "mr",
    ]);
  });
});
