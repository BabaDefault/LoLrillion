import { expect, test } from "@playwright/test";

/**
 * Deployed-safe smoke checks: read-only, so they can run against the live site or a preview
 * (`PLAYWRIGHT_BASE_URL=...`) as well as locally. They never start a Prompt or submit a Guess,
 * so they leave no plays behind and work whatever today's real Puzzle is.
 */

test("the home page offers today's Puzzle without revealing it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Prompt 1 of 7")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(page.getByText("isn't endorsed by Riot Games")).toBeVisible();
});

test("the Puzzle state API withholds the Prompt and every Answer Set", async ({ request }) => {
  const res = await request.get("/api/puzzle/state");
  expect(res.ok()).toBeTruthy();
  const state = await res.json();
  expect(state).toMatchObject({ promptCount: 7, finished: false, current: { index: 0, status: "not-started" } });
  expect(JSON.stringify(state)).not.toContain("answerSet");
});

test("results stay locked until the Puzzle is finished", async ({ request }) => {
  const res = await request.get("/api/puzzle/results");
  const body = await res.json();
  expect(body.ok).toBe(false);
  expect(JSON.stringify(body)).not.toContain("answerSet");
});

test("the leaderboards, stats and archive pages load", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: "Leaderboards" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Global" })).toBeVisible();
  for (const path of ["/stats", "/archive"]) {
    const res = await page.goto(path);
    expect(res?.ok(), path).toBeTruthy();
  }
});

test("a deployed site has no test hooks", async ({ request }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "the local smoke server enables them on purpose");
  for (const path of ["/api/test/clock", "/api/test/reset"]) {
    const res = await request.post(path, { data: { advanceMs: 1 } });
    expect(res.status(), path).toBe(404);
  }
});
