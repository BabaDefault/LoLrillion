import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkApprovedReview } from "./approve";
import type { ApprovedReview } from "./types";

/**
 * Committed approvals that fail a check and are waiting for the maintainer to re-pick. Never "fix" them
 * here by editing their Gem or Typicality: that is the maintainer's call. These stay red in
 * `puzzles:build`; `it.fails` turns green-but-listed here into a test failure once the file is fixed,
 * so the entry gets removed.
 */
const AWAITING_MAINTAINER: Record<string, string> = {};

const dir = fileURLToPath(new URL("../content/reviews/approved", import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();

describe("committed approved reviews", () => {
  for (const file of files) {
    const review = JSON.parse(readFileSync(`${dir}/${file}`, "utf8")) as ApprovedReview;
    const awaiting = AWAITING_MAINTAINER[review.templateId];
    const test = awaiting ? it.fails : it;
    test(`${file} is consistent, so puzzles:build can read it${awaiting ? ` (known failure: ${awaiting})` : ""}`, () => {
      expect(checkApprovedReview(review)).toEqual([]);
    });
  }
});
