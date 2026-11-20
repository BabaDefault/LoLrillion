import type { GeneratedPuzzle } from "@/builder";
import type { EntityId, Tier } from "@/engine";
import type { AnswerCounts } from "@/server/storage/answer-counts";

/** One Template's Answer Share over every Puzzle Day it was played: for re-tiering by hand. */
export interface TemplateAnswerShare {
  templateId: string;
  /** Puzzle Days with counts on which the Template was a Prompt. */
  days: string[];
  /** Players summed over those days: the denominator for `share`. */
  players: number;
  /** Every Entity of the Answer Set, most chosen first; `tier` is from the latest Puzzle. */
  answers: Array<{ entity: EntityId; tier: Tier; count: number; share: number }>;
}

/**
 * Answer Share per Template, from the dated Puzzles and each day's Answer Counts (counted plays only).
 * Days without counts are skipped. Sorted by Template ID.
 */
export function answerShareReport(
  puzzles: readonly GeneratedPuzzle[],
  countsByDay: Readonly<Record<string, AnswerCounts>>,
): TemplateAnswerShare[] {
  const byTemplate = new Map<string, { days: string[]; players: number; tiers: Record<EntityId, Tier>; counts: Map<EntityId, number> }>();
  const ordered = [...puzzles].sort((a, b) => a.puzzleDay.localeCompare(b.puzzleDay));

  for (const puzzle of ordered) {
    const counts = countsByDay[puzzle.puzzleDay];
    if (!counts) continue;
    puzzle.prompts.forEach((prompt, index) => {
      const entry = byTemplate.get(prompt.templateId) ?? { days: [], players: 0, tiers: {}, counts: new Map() };
      byTemplate.set(prompt.templateId, entry);
      entry.days.push(puzzle.puzzleDay);
      entry.players += counts.players;
      entry.tiers = prompt.answerSet;
      for (const [entity, n] of Object.entries(counts.byPrompt[index] ?? {})) {
        entry.counts.set(entity, (entry.counts.get(entity) ?? 0) + n);
      }
    });
  }

  return [...byTemplate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([templateId, { days, players, tiers, counts }]) => ({
      templateId,
      days,
      players,
      answers: Object.entries(tiers)
        .map(([entity, tier]) => {
          const count = counts.get(entity) ?? 0;
          return { entity, tier, count, share: players ? count / players : 0 };
        })
        .sort((a, b) => b.count - a.count || a.entity.localeCompare(b.entity)),
    }));
}
