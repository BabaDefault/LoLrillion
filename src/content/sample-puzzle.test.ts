import { describe, expect, it } from "vitest";
import { openPrompt, submitAttempt } from "@/engine";
import { samplePuzzleSource } from "@/server/puzzle-source";
import { entityRegistry } from "./game-data";

describe("the sample Puzzle", () => {
  it("is served with the real Entity registry", async () => {
    const { entities } = await samplePuzzleSource.forDay("2026-11-20");
    expect(entities).toBe(entityRegistry);
  });

  it("only uses real Entity IDs of each Prompt's Answer Type", async () => {
    const { puzzle } = await samplePuzzleSource.forDay("2026-11-20");
    const byId = new Map(entityRegistry.map((e) => [e.id, e]));
    for (const prompt of puzzle.prompts) {
      for (const id of Object.keys(prompt.answerSet)) {
        expect(byId.get(id)?.answerType, `${prompt.text}: ${id}`).toBe(prompt.answerType);
      }
    }
  });

  it("accepts a typed Guess for every Prompt", async () => {
    const { puzzle, entities } = await samplePuzzleSource.forDay("2026-11-20");
    const guesses = ["Yasuo", "Thresh", "Twitch", "mercs", "Thornmail", "vi", "karthus"];
    puzzle.prompts.forEach((prompt, i) => {
      const { result } = submitAttempt({ prompt, entities, play: openPrompt(0), guess: guesses[i], now: 6_000 });
      expect(result.kind, `${prompt.text}: ${guesses[i]}`).toBe("accepted");
    });
  });
});
