import type { MechanicsLabel } from "@/labels";
import approved from "./approved.json";

/**
 * Approved mechanics labels: the only labels the Builder reads. Every quote is checked against the
 * committed snapshot by `approved-labels.test.ts`. Proposals (`./proposals/`) are never read here.
 */
export const approvedLabels: readonly MechanicsLabel[] = approved as MechanicsLabel[];
