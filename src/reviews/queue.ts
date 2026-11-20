import type { EntityId } from "@/engine";
import type { ApprovedReview, InvalidApproval, QueueEntry } from "./types";

/**
 * The review queue: every Template whose approval fails today's checks ("needs re-approval", first),
 * that was never approved, or whose current Answer Set differs from the one it was approved on
 * (after a data refresh). Unchanged Templates stay approved. Otherwise sorted by Template ID.
 */
export function reviewQueue(
  currentAnswerSets: Readonly<Record<string, readonly EntityId[]>>,
  approved: Readonly<Record<string, ApprovedReview>>,
  invalid: Readonly<Record<string, Pick<InvalidApproval, "review" | "problems">>> = {},
): QueueEntry[] {
  const needsReapproval: QueueEntry[] = [];
  const queue: QueueEntry[] = [];
  for (const templateId of Object.keys(currentAnswerSets).sort()) {
    const current = currentAnswerSets[templateId];
    if (invalid[templateId]) {
      needsReapproval.push({ templateId, status: "needs re-approval", added: [], removed: [], problems: [...invalid[templateId].problems] });
      continue;
    }
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
  return [...needsReapproval, ...queue];
}
