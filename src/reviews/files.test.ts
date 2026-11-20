import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readApprovedReviews } from "./files";
import type { ApprovedReview } from "./types";

const approved: ApprovedReview = {
  templateId: "champions-yordle",
  dataVersion: "16.23.1",
  answerSet: ["champion:Kled", "champion:Teemo"],
  typicality: { "champion:Teemo": 0.9, "champion:Kled": 0.1 },
  tooClever: [],
  gem: "champion:Kled",
};

function reviewsDir(files: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "reviews-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), JSON.stringify(content));
  }
  return root;
}

describe("reading approved reviews for the Builder", () => {
  it("reads only approved files, keyed by Template; proposals never reach the Builder", async () => {
    const root = reviewsDir({
      "approved/champions-yordle.json": approved,
      "proposals/champions-region-ionia.json": { templateId: "champions-region-ionia", gemCandidates: [] },
    });
    expect(await readApprovedReviews(root)).toEqual({ "champions-yordle": approved });
  });

  it("is empty when nothing is approved yet", async () => {
    expect(await readApprovedReviews(reviewsDir({}))).toEqual({});
  });

  it("refuses to build from an inconsistent approved file", async () => {
    const root = reviewsDir({ "approved/champions-yordle.json": { ...approved, gem: "champion:Veigar" } });
    await expect(readApprovedReviews(root)).rejects.toThrow(/champions-yordle.*Gem champion:Veigar/s);
  });

  it("refuses a file whose name doesn't match its Template ID", async () => {
    const root = reviewsDir({ "approved/other.json": approved });
    await expect(readApprovedReviews(root)).rejects.toThrow(/other\.json/);
  });
});
