import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readApprovedReviewFiles, readApprovedReviews } from "./files";
import type { ApprovedReview } from "./types";

const approved: ApprovedReview = {
  templateId: "champions-dash",
  dataVersion: "16.23.1",
  answerSet: ["champion:Rell", "champion:Yasuo"],
  typicality: { "champion:Yasuo": 0.9, "champion:Rell": 0.1 },
  tooClever: [],
  gem: "champion:Rell",
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
      "approved/champions-dash.json": approved,
      "proposals/champions-stun.json": { templateId: "champions-stun", gemCandidates: [] },
    });
    expect(await readApprovedReviews(root)).toEqual({ "champions-dash": approved });
  });

  it("is empty when nothing is approved yet", async () => {
    expect(await readApprovedReviews(reviewsDir({}))).toEqual({});
  });

  it("refuses to build from an inconsistent approved file", async () => {
    const root = reviewsDir({ "approved/champions-dash.json": { ...approved, gem: "champion:Annie" } });
    await expect(readApprovedReviews(root)).rejects.toThrow(/champions-dash.*Gem champion:Annie/s);
  });

  it("refuses a file whose name doesn't match its Template ID", async () => {
    const root = reviewsDir({ "approved/other.json": approved });
    await expect(readApprovedReviews(root)).rejects.toThrow(/other\.json/);
  });
});

describe("reading approved reviews for maintainer scripts", () => {
  it("keeps going past an inconsistent approval, returning it with its problems", async () => {
    const bad = { ...approved, templateId: "champions-stun", gem: "champion:Annie" };
    const root = reviewsDir({ "approved/champions-dash.json": approved, "approved/champions-stun.json": bad });
    const { valid, invalid } = await readApprovedReviewFiles(root);
    expect(valid).toEqual({ "champions-dash": approved });
    expect(Object.keys(invalid)).toEqual(["champions-stun"]);
    expect(invalid["champions-stun"].review).toEqual(bad);
    expect(invalid["champions-stun"].problems.join("\n")).toMatch(/Gem champion:Annie/);
  });

  it("reports a misnamed file as invalid", async () => {
    const { valid, invalid } = await readApprovedReviewFiles(reviewsDir({ "approved/other.json": approved }));
    expect(valid).toEqual({});
    expect(invalid["champions-dash"].problems.join("\n")).toMatch(/other\.json/);
  });
});
