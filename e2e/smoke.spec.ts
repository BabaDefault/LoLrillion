import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

/**
 * Full-day smoke test (spec Seam 3): two devices play the fixed smoke Puzzle
 * (`src/server/smoke-puzzle.ts`) through the production build, then meet on a group leaderboard.
 * Needs a server in smoke-test mode; never runs against a deployed URL.
 *
 * Time never passes for real: `advance` jumps the server clock (`/api/test/clock`) and the
 * browser's clock (Playwright's `page.clock`) together.
 */

/** The smoke clock starts on Sydney Puzzle Day 2027-01-15: 56 days after #1 (2026-11-20). */
const PUZZLE_NUMBER = 57;
const READ_MS = 5_000;
/** The 25s answer window plus the 2s network grace, plus a little. */
const TIMEOUT_MS = 25_000 + 2_000 + 500;

async function advance(request: APIRequestContext, page: Page, ms: number) {
  const res = await request.post("/api/test/clock", { data: { advanceMs: ms } });
  expect(res.ok(), "the server must run in smoke-test mode").toBeTruthy();
  await page.clock.fastForward(ms);
}

async function newPlayer(browser: Browser, baseURL: string): Promise<Page> {
  // A separate context is a separate device (its own device cookie).
  const context = await browser.newContext({ baseURL, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  await page.clock.install();
  return page;
}

const guessInput = (page: Page) => page.getByRole("textbox", { name: "Guess" });

/** Show the next Prompt and skip its 5s read window. */
async function openPrompt(request: APIRequestContext, page: Page, n: number, text: string) {
  await expect(page.getByText(`Prompt ${n} of 7`)).toBeVisible();
  await page.getByRole("button", { name: n === 1 ? "Start" : "Show Prompt" }).click();
  await expect(page.getByRole("heading", { name: text })).toBeVisible();
  await expect(guessInput(page)).toBeDisabled(); // locked while reading
  await advance(request, page, READ_MS);
  await expect(guessInput(page)).toBeEnabled();
}

async function guess(page: Page, text: string) {
  await guessInput(page).fill(text);
  await guessInput(page).press("Enter");
}

/** The score interlude after a Prompt, then on to the next one. */
async function expectScore(page: Page, tier: string, points: number, last = false) {
  await expect(page.getByText(tier, { exact: true })).toBeVisible();
  await expect(page.getByText(`+${points}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: last ? "See your results" : "Next Prompt" }).click();
}

async function setNickname(page: Page, nickname: string) {
  await page.getByLabel("Nickname").fill(nickname);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("nickname")).toHaveText(nickname);
}

test("a full Puzzle Day on two devices, ending on a group leaderboard", async ({ browser, request, baseURL }) => {
  const reset = await request.post("/api/test/reset");
  expect(reset.ok(), "the server must run in smoke-test mode").toBeTruthy();

  // ---- Device A plays every flow ----
  const alice = await newPlayer(browser, baseURL!);
  await alice.goto("/");

  // 1. A Rejected Attempt, then an Accepted Guess.
  await openPrompt(request, alice, 1, "Smoke 1: name a ranged champion");
  await guess(alice, "Garen");
  await expect(guessInput(alice)).toHaveClass(/shake/);
  await expect(guessInput(alice)).toBeEnabled();
  await guess(alice, "Teemo");
  await expect(alice.getByText("Locked in: Teemo")).toBeVisible();
  await expectScore(alice, "Minion", 10);

  // 2. A wrong Answer Type message, then a Did-you-mean confirmation.
  await openPrompt(request, alice, 2, "Smoke 2: name a mage");
  await guess(alice, "Infinity Edge");
  await expect(alice.getByText("This asks for a champion.")).toBeVisible();
  await guess(alice, "Kasadin");
  const popup = alice.getByRole("dialog", { name: "Did you mean" });
  await expect(popup).toBeVisible();
  await popup.getByRole("button", { name: "Yes, Kassadin" }).click();
  await expectScore(alice, "Pentakill", 100);

  // 3. A timeout Miss.
  await openPrompt(request, alice, 3, "Smoke 3: name a champion");
  await advance(request, alice, TIMEOUT_MS);
  await expect(alice.getByText("Time's up.")).toBeVisible();
  await expectScore(alice, "Miss", 0);

  // 4-7. Accepted Guesses across the remaining Tiers.
  await openPrompt(request, alice, 4, "Smoke 4: name an item");
  await guess(alice, "infinity edge");
  await expectScore(alice, "Triple Kill", 60);
  await openPrompt(request, alice, 5, "Smoke 5: name a champion");
  await guess(alice, "Lux");
  await expectScore(alice, "Kill", 30);
  await openPrompt(request, alice, 6, "Smoke 6: name a champion");
  await guess(alice, "Garen");
  await expectScore(alice, "Quadra Kill", 85);
  await openPrompt(request, alice, 7, "Smoke 7: name a champion");
  await guess(alice, "Annie");
  await expectScore(alice, "Too Clever", 15, true);

  // End screen: total, day title, percentile, Answer Sets, and the share line.
  await expect(alice.getByTestId("total")).toHaveText("300");
  await expect(alice.getByTestId("day-title")).toHaveText("Gold");
  await expect(alice.getByTestId("percentile")).toContainText("of today's 1 player");
  await expect(alice.getByText(`LoLrillion #${PUZZLE_NUMBER}`, { exact: true })).toBeVisible();
  // Every Prompt's Answer Set is revealed; the smoke Puzzle's only Gem is Prompt 2's Kassadin.
  await expect(alice.locator("section.reveal")).toHaveCount(7);
  await expect(alice.locator(".answer-set li.gem")).toHaveCount(1);
  await expect(alice.locator(".answer-set li.gem")).toContainText("Kassadin");
  await alice.getByRole("button", { name: "Share" }).click();
  await expect(alice.getByText("Share line copied.")).toBeVisible();
  // The OS clipboard may store line breaks as \r\n (Windows).
  const shared = (await alice.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
  expect(shared).toBe(
    [`LoLrillion #${PUZZLE_NUMBER} · 300/700 · Gold`, "🟦💎⬛🟨🟩🟧🤡", new URL(baseURL!).origin].join("\n"),
  );

  // Device A names itself and creates a friend group.
  await alice.getByTestId("leaderboard-link").click();
  await setNickname(alice, "Alice");
  await alice.getByLabel("New group").fill("Smoke Squad");
  await alice.getByRole("button", { name: "Create" }).click();
  const code = (await alice.locator(".group-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  // ---- Device B plays the same day and joins the group ----
  const bob = await newPlayer(browser, baseURL!);
  await bob.goto("/");
  const bobGuesses = ["Annie", "Ahri", "Garen", "Zhonyas", "Ahri", "Annie", "Teemo"];
  for (const [i, text] of bobGuesses.entries()) {
    await openPrompt(request, bob, i + 1, `Smoke ${i + 1}:`);
    await guess(bob, text);
    await expect(bob.getByText(`Locked in:`)).toBeVisible();
    await bob.getByRole("button", { name: i === 6 ? "See your results" : "Next Prompt" }).click();
  }
  // Kill 30 + six Minions at 10.
  await expect(bob.getByTestId("total")).toHaveText("90");
  await expect(bob.getByTestId("day-title")).toHaveText("Iron");
  await expect(bob.getByTestId("percentile")).toContainText("of today's 2 players");

  await bob.goto(`/leaderboard?join=${code}`);
  await setNickname(bob, "Bob");
  await bob.getByRole("button", { name: "Join" }).click();
  await expect(bob.getByText('Joined "Smoke Squad".')).toBeVisible();

  // The group leaderboard shows both players, best first, from either device.
  for (const [page, you] of [
    [bob, "Bob"],
    [alice, "Alice"],
  ] as const) {
    if (page === alice) {
      await alice.reload();
      await alice.getByRole("button", { name: "Smoke Squad" }).click();
    }
    await expect(page.getByRole("button", { name: "Smoke Squad" })).toHaveAttribute("aria-pressed", "true");
    const rows = page.getByTestId("leaderboard").locator("li");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Alice");
    await expect(rows.nth(0)).toContainText("300");
    await expect(rows.nth(1)).toContainText("Bob");
    await expect(rows.nth(1)).toContainText("90");
    await expect(page.getByTestId("leaderboard").locator("li.you")).toContainText(you);
  }
});
