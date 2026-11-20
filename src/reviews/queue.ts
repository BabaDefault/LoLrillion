import type { EntityId } from "@/engine";
import type { ApprovedReview, QueueEntry } from "./types";

/**
 * The review queue: every Template that was never approved, or whose current Answer Set differs
 * from the one it was approved on (after a data refresh). Unchanged Templates stay approved.
 * Sorted by Template ID.
 */
export function reviewQueue(
  currentAnswerSets: Readonly<Record<string, readonly EntityId[]>>,
  approved: Readonly<Record<string, ApprovedReview>>,
): QueueEntry[] {
  const queue: QueueEntry[] = [];
  for (const templateId of Object.keys(currentAnswerSets).sort()) {
    const current = currentAnswerSets[templateId];
    const review = approved[templateId];
    if (!review) {
      queue.push({ templateId, status: "unreviewed", added: [...current].sort(), removed: [] });
      continue;
    }
    const before = new Set(review.answerSet);
    const now = new Set(current);
    const added = [...now].filter((id) => !before.has(id)).sort();
    const removed = [...before].filter((id) => !now.has(id)).sort();
    if (added.length || removed.length) queue.push({ templateId, status: "changed", added, removed });
  }
  return queue;
}
