import { describe, expect, it } from "vitest";
import { esportsSnapshotFromRaw, type RawEsportsData } from "./transform";

const raw: RawEsportsData = {
  fetchedAt: "2026-11-21",
  winners: [
    { Event: "Worlds Season 3", Team: "SK Telecom T1", RosterPage: "Season 3 World Championship" },
    { Event: "Worlds 2022", Team: "DRX", RosterPage: "2022 Season World Championship/Main Event" },
    // Not a World Championship: a qualifier sharing the "Worlds" prefix.
    { Event: "Worlds Season 1 Qualifier - NA", Team: "TSM", RosterPage: "Season 1 World Championship/Qualifiers/North America" },
  ],
  rosters: [
    { Team: "SK Telecom T1", Link: "Faker", Role: "Mid", OverviewPage: "Season 3 World Championship" },
    // Linked through a redirect whose case differs from the player page.
    { Team: "SK Telecom T1", Link: "bengi", Role: "Jungle", OverviewPage: "Season 3 World Championship" },
    { Team: "SK Telecom T1", Link: "kkOma", Role: "Coach", OverviewPage: "Season 3 World Championship" },
    // Another team at the same event: not a winner, but a decoy player.
    { Team: "Royal Club", Link: "Uzi", Role: "Bot", OverviewPage: "Season 3 World Championship" },
    // A qualifier's roster: neither a winner nor a decoy.
    { Team: "TSM", Link: "Reginald", Role: "Mid", OverviewPage: "Season 1 World Championship/Qualifiers/North America" },
    { Team: "DRX", Link: "Zeka (Kim Geon-woo)", Role: "Mid", OverviewPage: "2022 Season World Championship/Main Event" },
    { Team: "DRX", Link: "Juhan", Role: "Jungle", OverviewPage: "2022 Season World Championship/Main Event" },
    { Team: "DRX", Link: "Faker", Role: "Mid", OverviewPage: "2022 Season World Championship/Main Event" },
    // A player page that is also another player's surname-style ID ("TIAN" below).
    { Team: "DRX", Link: "Tian", Role: "Jungle", OverviewPage: "2022 Season World Championship/Main Event" },
    // Linked with different case inside the name: Leaguepedia matches names case-insensitively.
    { Team: "DRX", Link: "JieJie", Role: "Jungle", OverviewPage: "2022 Season World Championship/Main Event" },
    // A lowercase IGN: Leaguepedia's page and ID are capitalized, its Players row flags it.
    { Team: "SK Telecom T1", Link: "xPeke", Role: "Top", OverviewPage: "Season 3 World Championship" },
  ],
  redirects: [
    { AllName: "Faker", OverviewPage: "Faker", ID: "Faker" },
    { AllName: "S LEE", OverviewPage: "Faker", ID: "S LEE" },
    { AllName: "Bengi", OverviewPage: "Bengi", ID: "Bengi" },
    { AllName: "JangTa", OverviewPage: "Bengi", ID: "JangTa" },
    { AllName: "Zeka (Kim Geon-woo)", OverviewPage: "Zeka (Kim Geon-woo)", ID: "Zeka" },
    { AllName: "Dean (Kim Geon-woo)", OverviewPage: "Zeka (Kim Geon-woo)", ID: "Dean" },
    { AllName: "Tian", OverviewPage: "Tian", ID: "Tian" },
    // After Tian's own row, so a last-row-wins lookup would hand Tian's roster slot and games to Zeka.
    { AllName: "TIAN", OverviewPage: "Zeka (Kim Geon-woo)", ID: "TIAN" },
    { AllName: "Jiejie", OverviewPage: "Jiejie", ID: "Jiejie" },
    { AllName: "XPeke", OverviewPage: "XPeke", ID: "XPeke" },
  ],
  lowercase: ["XPeke"],
  games: [
    { Link: "Faker", Games: "1500" },
    { Link: "Bengi", Games: "300" },
    { Link: "JangTa", Games: "20" },
    { Link: "Zeka (Kim Geon-woo)", Games: "400" },
    { Link: "Dean (Kim Geon-woo)", Games: "10" },
    { Link: "JieJie", Games: "500" },
    { Link: "Tian", Games: "700" },
  ],
};

describe("Esports snapshot from Leaguepedia rows", () => {
  const snapshot = esportsSnapshotFromRaw(raw);

  it("keeps only World Championship winners, with the season year", () => {
    expect(snapshot.worldsWins.map((w) => [w.year, w.team])).toEqual([
      [2013, "SK Telecom T1"],
      [2022, "DRX"],
    ]);
    expect(snapshot.worldsWins[0].source).toBe("https://lol.fandom.com/wiki/Season_3_World_Championship");
  });

  it("lists the winning roster's players by player page, without coaches or other teams", () => {
    expect(snapshot.worldsWins[0].players).toEqual(["Bengi", "Faker", "XPeke"]);
    expect(snapshot.worldsWins[1].players).toEqual(["Faker", "Jiejie", "Juhan", "Tian", "Zeka (Kim Geon-woo)"]);
  });

  it("has one player per page, named by current IGN, with former IGNs and pro games over all names", () => {
    const zeka = snapshot.players.find((p) => p.id === "Zeka (Kim Geon-woo)");
    expect(zeka).toEqual({
      id: "Zeka (Kim Geon-woo)",
      name: "Zeka",
      formerNames: ["Dean"],
      proGames: 410,
      source: "https://lol.fandom.com/wiki/Zeka_(Kim_Geon-woo)",
    });
    expect(snapshot.players.map((p) => p.id)).toEqual(["Bengi", "Faker", "Jiejie", "Juhan", "Tian", "Uzi", "XPeke", "Zeka (Kim Geon-woo)"]);
    expect(snapshot.players.find((p) => p.id === "Bengi")).toMatchObject({ formerNames: ["JangTa"], proGames: 320 });
  });

  it("lists every Worlds team's players as decoys, but no coaches or qualifier rosters", () => {
    const ids = snapshot.players.map((p) => p.id);
    expect(ids).toContain("Uzi");
    expect(ids).not.toContain("kkOma");
    expect(ids).not.toContain("Reginald");
    expect(snapshot.worldsWins.flatMap((w) => w.players)).not.toContain("Uzi");
  });

  it("matches names case-insensitively, as Leaguepedia does", () => {
    expect(snapshot.players.find((p) => p.id === "Jiejie")).toMatchObject({ name: "Jiejie", proGames: 500 });
  });

  it("counts a name's games once when queries in different chunks return the same case-insensitive group", () => {
    const repeated = esportsSnapshotFromRaw({ ...raw, games: [...raw.games, { Link: "Jiejie", Games: "500" }] });
    expect(repeated.players.find((p) => p.id === "Jiejie")).toMatchObject({ proGames: 500 });
  });

  it("keeps a name that is a player page with that player, whatever other players' redirects say", () => {
    expect(snapshot.players.find((p) => p.id === "Tian")).toMatchObject({ proGames: 700 });
    expect(snapshot.players.find((p) => p.id === "Zeka (Kim Geon-woo)")).toMatchObject({ proGames: 410 });
  });

  it("drops surname-style IDs (\"S LEE\", \"TIAN\") from former IGNs", () => {
    expect(snapshot.players.find((p) => p.id === "Faker")).toMatchObject({ formerNames: [] });
    expect(snapshot.players.find((p) => p.id === "Zeka (Kim Geon-woo)")).toMatchObject({ formerNames: ["Dean"] });
  });

  it("drops a former IGN that another player also had, or that is another player's IGN", () => {
    const shared = esportsSnapshotFromRaw({
      ...raw,
      redirects: [
        ...raw.redirects,
        { AllName: "Uzi", OverviewPage: "Uzi", ID: "Uzi" },
        { AllName: "Dean (Jian Zi-Hao)", OverviewPage: "Uzi", ID: "Dean" },
        { AllName: "Bengi (Jian Zi-Hao)", OverviewPage: "Uzi", ID: "Bengi" },
      ],
    });
    expect(shared.players.find((p) => p.id === "Zeka (Kim Geon-woo)")).toMatchObject({ formerNames: [] });
    expect(shared.players.find((p) => p.id === "Uzi")).toMatchObject({ formerNames: [] });
  });

  it("writes a lowercase IGN in lowercase", () => {
    expect(snapshot.players.find((p) => p.id === "XPeke")).toMatchObject({ name: "xPeke" });
  });

  it("falls back to the page name, minus any disambiguation, for a player with no redirect rows", () => {
    expect(snapshot.players.find((p) => p.id === "Juhan")).toMatchObject({ name: "Juhan", formerNames: [], proGames: 0 });
  });

  it("dates the snapshot", () => {
    expect(snapshot.fetchedAt).toBe("2026-11-21");
  });
});
