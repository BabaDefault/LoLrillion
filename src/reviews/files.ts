import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { checkApprovedReview } from "./approve";
import type { ApprovedReview, InvalidApproval } from "./types";

/**
 * Every approved review under `<reviewsDir>/approved/`, split into those that pass today's checks
 * (`valid`, keyed by Template ID) and those that don't (`invalid`, with their problems). Never throws
 * on an inconsistent file, so maintainer scripts (the review queue, re-approval) keep running.
 * `proposals/` is never read. Node-only (scripts, tests).
 */
export async function readApprovedReviewFiles(
  reviewsDir: string,
): Promise<{ valid: Record<string, ApprovedReview>; invalid: Record<string, InvalidApproval> }> {
  const dir = join(reviewsDir, "approved");
  const valid: Record<string, ApprovedReview> = {};
  const invalid: Record<string, InvalidApproval> = {};
  if (!existsSync(dir)) return { valid, invalid };
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json")).sort()) {
    const review = JSON.parse(await readFile(join(dir, file), "utf8")) as ApprovedReview;
    const problems = checkApprovedReview(review);
    if (file !== `${review.templateId}.json`) problems.unshift(`${file}: file name must be <templateId>.json (${review.templateId})`);
    if (problems.length) invalid[review.templateId] = { file, review, problems };
    else valid[review.templateId] = review;
  }
  return { valid, invalid };
}

/**
 * Every approved review, keyed by Template ID: the only review data `puzzles:build` hands to the
 * Builder. Throws on any inconsistent file, so a bad approval stops the build instead of reaching a
 * Puzzle. Node-only (scripts, tests).
 */
export async function readApprovedReviews(reviewsDir: string): Promise<Record<string, ApprovedReview>> {
  const { valid, invalid } = await readApprovedReviewFiles(reviewsDir);
  const problems = Object.values(invalid).flatMap(({ file, review, problems }) =>
    problems.map((p) => `${file} (${review.templateId}): ${p}`),
  );
  if (problems.length) throw new Error(`Invalid approved reviews:\n${problems.join("\n")}`);
  return valid;
}
