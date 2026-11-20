"use client";

import { useEffect, useState } from "react";
import type { DayStatsView } from "@/server/game-service";

/** End-screen block: percentile, the day's score-distribution curve, and "N players chose this". */
export function DayStatsPanel() {
  const [stats, setStats] = useState<DayStatsView | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/puzzle/stats", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<DayStatsView>) : null))
      .then((s) => !cancelled && setStats(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) return null;
  const peak = Math.max(1, ...stats.distribution.bins.map((b) => b.count));

  return (
    <div className="day-stats">
      <p data-testid="percentile">
        Better than <strong>{stats.percentile}%</strong> of today&apos;s {stats.playerCount} players
      </p>
      <div className="curve" role="img" aria-label="Today's score distribution, your bin highlighted">
        {stats.distribution.bins.map((b, i) => (
          <div
            key={b.from}
            className={i === stats.distribution.yourBin ? "bar you" : "bar"}
            style={{ height: `${Math.max(4, (b.count / peak) * 100)}%` }}
            title={`${b.from}–${b.to}: ${b.count}`}
          />
        ))}
      </div>
      <ol className="chosen-by">
        {stats.chosenBy.map((n, i) => (
          <li key={i} className="muted">
            Prompt {i + 1}: {n === null ? "Miss" : `${n} ${n === 1 ? "player" : "players"} chose this`}
          </li>
        ))}
      </ol>
    </div>
  );
}
