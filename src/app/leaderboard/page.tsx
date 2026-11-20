import type { Metadata } from "next";
import { LeaderboardScreen } from "./leaderboard-screen";

export const metadata: Metadata = { title: "Leaderboards · LoLrillion" };

export default function LeaderboardPage() {
  return (
    <>
      <h1 className="title">Leaderboards</h1>
      <LeaderboardScreen />
    </>
  );
}
