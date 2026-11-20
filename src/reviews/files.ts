import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { checkApprovedReview } from "./approve";
import type { ApprovedReview } from "./types";

/**
 * Every approved review under `<reviewsDir>/approved/`, keyed by Template ID: the only review data
 * maintainer scripts hand to the Builder. `proposals/` is never read. Throws on an inconsistent
 * file, so a bad approval stops the build instead of reaching a Puzzle. Node-only (scripts, tests).
 */
export async function readApprovedReviews(reviewsDir: string): Promise<Record<string, ApprovedReview>> {
  const dir = join(reviewsDir, "approved");
  if (!existsSync(dir)) return {};
  const reviews: Record<string, ApprovedReview> = {};
  const problems: string[] = [];
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json")).sort()) {
    const review = JSON.parse(await readFile(join(dir, file), "utf8")) as ApprovedReview;
    if (file !== `${review.templateId}.json`) problems.push(`${file}: file name must be <templateId>.json (${review.templateId})`);
    problems.push(...checkApprovedReview(review).map((p) => `${file} (${review.templateId}): ${p}`));
    reviews[review.templateId] = review;
  }
  if (problems.length) throw new Error(`Invalid approved reviews:\n${problems.join("\n")}`);
  return reviews;
}
