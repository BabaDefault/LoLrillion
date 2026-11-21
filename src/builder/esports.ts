import type { EsportsSnapshot } from "@/content/esports/snapshot";
import { ESPORTS_ANSWER_TYPES, type AnswerType } from "@/engine";
import type { BuilderInputs } from "./types";

/** Answer Types whose Answer Sets come from the esports snapshot, not the game data. */
export const isEsportsAnswerType = (answerType: AnswerType) => ESPORTS_ANSWER_TYPES.has(answerType);

/** The esports snapshot, which esports Templates can't be built without. */
export function requireEsports(inputs: BuilderInputs): EsportsSnapshot {
  if (!inputs.esports) throw new Error("This Template needs the esports snapshot (src/content/esports/snapshot.json).");
  return inputs.esports;
}

/** The data version of an esports-built Prompt, e.g. "esports:2026-11-21". */
export const esportsVersion = (esports: EsportsSnapshot) => `esports:${esports.fetchedAt}`;
