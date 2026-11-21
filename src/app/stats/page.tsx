import type { Metadata } from "next";
import { StatsView } from "./stats-view";

export const metadata: Metadata = { title: "Your stats" };

export default function StatsPage() {
  return (
    <>
      <h1 className="title">Your stats</h1>
      <StatsView />
    </>
  );
}
