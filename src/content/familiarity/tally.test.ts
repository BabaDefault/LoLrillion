import { describe, expect, it } from "vitest";
import masteryA from "./__fixtures__/mastery-a.json";
import masteryB from "./__fixtures__/mastery-b.json";
import match1 from "./__fixtures__/match-1.json";
import match2 from "./__fixtures__/match-2.json";
import matchOldPatch from "./__fixtures__/match-old-patch.json";
import { tallyFamiliarity, type FamiliarityCatalog } from "./tally";

const catalog: FamiliarityCatalog = {
  patch: "16.23.1",
  champions: [
    { id: "Aatrox", key: 266 },
    { id: "Ahri", key: 103 },
    { id: "MissFortune", key: 21 },
    { id: "MonkeyKing", key: 62 },
  ],
  items: ["1055", "2003", "3006", "3031", "3047", "3071", "3364", "6333"].map((id) => ({ id })),
};

describe("tallyFamiliarity", () => {
  const file = tallyFamiliarity({
    catalog,
    masteries: [masteryA, masteryB],
    matches: [match1, match2, matchOldPatch],
  });

  it("labels the file with the snapshot patch", () => {
    expect(file.patch).toBe("16.23.1");
  });

  it("gives each champion its share of the summed lifetime mastery", () => {
    // Known champions sum to 500k points: Wukong 400k, Aatrox 100k, Ahri 0. Unknown champion 99999 is ignored.
    expect(file.champions["champion:MonkeyKing"].mastery).toBeCloseTo(0.8);
    expect(file.champions["champion:Aatrox"].mastery).toBeCloseTo(0.2);
    expect(file.champions["champion:Ahri"].mastery).toBe(0);
  });

  it("gives each champion its pick rate over current-patch matches only", () => {
    expect(file.champions["champion:MonkeyKing"].pickRate).toBe(1);
    expect(file.champions["champion:Aatrox"].pickRate).toBe(0.5);
    expect(file.champions["champion:Ahri"].pickRate).toBe(0.5);
  });

  it("lists every catalog champion and item, zero when never seen", () => {
    expect(file.champions["champion:MissFortune"]).toEqual({ mastery: 0, pickRate: 0 });
    expect(file.items["item:3006"]).toEqual({ buildRate: 0 });
    expect(Object.keys(file.champions)).toHaveLength(4);
    expect(Object.keys(file.items)).toHaveLength(8);
  });

  it("gives each item the share of players who finished with it, counting duplicates once", () => {
    // 4 current-patch participants.
    expect(file.items["item:3071"].buildRate).toBe(0.75);
    expect(file.items["item:3047"].buildRate).toBe(0.5);
    expect(file.items["item:3031"].buildRate).toBe(0.25);
    expect(file.items["item:1055"].buildRate).toBe(0.25);
  });

  it("ignores the trinket slot", () => {
    expect(file.items["item:3364"].buildRate).toBe(0);
  });

  it("records only anonymous sample counts", () => {
    expect(file.sample).toEqual({ players: 2, matches: 2 });
    expect(JSON.stringify(file)).not.toMatch(/PUUID|NA1_|KR_|EUW1_/);
  });

  it("tolerates malformed responses", () => {
    const odd = tallyFamiliarity({ catalog, masteries: [null, {}], matches: [null, { info: {} }] });
    expect(odd.champions["champion:MonkeyKing"]).toEqual({ mastery: 0, pickRate: 0 });
  });
});
