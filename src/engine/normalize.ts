/**
 * Reduce a Guess (or an Entity name / Alias) to the form used for exact matching:
 * lowercase, with apostrophes, spaces, periods, `&` and any other punctuation removed.
 */
export function normalizeGuess(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}
