/**
 * Hand-curated Yordles, keyed by Data Dragon champion id. Neither Data Dragon, Community Dragon nor the
 * Universe API's `races` field marks Yordles, so each one is confirmed by text in the champion's Universe
 * biography (`https://universe.leagueoflegends.com/en_US/champion/<slug>/`), quoted here.
 *
 * Not Yordles, though their bios mention them: Yuumi (a magical cat), Neeko (vastaya). Amumu is ambiguous
 * (one of several legends calls him "the first and last Yordle ruler of Shurima"), so he's left out.
 */
export const YORDLE_EVIDENCE: Readonly<Record<string, string>> = {
  Corki: "When Heimerdinger and his yordle colleagues migrated to Piltover...",
  Fizz: "...it was here that the yordle Fizz made his home",
  Gnar: "A young yordle with boundless energy, Gnar...",
  Heimerdinger: "A brilliant yet eccentric yordle scientist...",
  Kennen: "...Bandle City was no place for a yordle like Kennen",
  Kled: "As a yordle, he made his home among the proud Noxii tribes...",
  Lulu: "Lulu was always a caring and deeply empathetic yordle...",
  Poppy: "...this determined yordle has spent untold years searching...",
  Rumble: "Even amongst yordles, Rumble was always the runt of the litter",
  Teemo: "When other yordles saw everything Teemo had accomplished...",
  Tristana: "Like most yordles, Tristana...",
  Veigar: "...yordles are not typically something to be feared",
  Vex: "...a lone yordle trudges through the spectral fog...",
  Ziggs: "...his chaotic, hyperactive nature was unusual among yordle scientists",
};
