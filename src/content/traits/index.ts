import type { ApprovedTrait } from "@/traits";
import approved from "./approved.json";

/** Approved curated traits: the only traits the Builder reads. Checked by `approved-traits.test.ts`. */
export const approvedTraits: readonly ApprovedTrait[] = approved as ApprovedTrait[];
