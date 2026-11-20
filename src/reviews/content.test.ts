import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readApprovedReviews } from "./files";

describe("committed approved reviews", () => {
  it("are all consistent, so puzzles:build can read them", async () => {
    const dir = fileURLToPath(new URL("../content/reviews", import.meta.url));
    await expect(readApprovedReviews(dir)).resolves.toBeDefined();
  });
});
