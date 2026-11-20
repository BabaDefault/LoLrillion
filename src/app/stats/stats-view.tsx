"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MISS_EMOJI, TIER_EMOJI, TIER_NAMES, type PersonalStats, type Tier } from "@/engine";
import { Empty, ErrorState, Loading } from "../status";
import { tierTone } from "../tier-tone";

const TIERS: Tier[] = ["pentakill", "quadra-kill", "triple-kill", "kill", "too-clever", "minion"];

/** This device's personal stats. */
export function StatsView() {
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/stats", { cache: "no-store" })
      .then((res) => res.json() as Promise<PersonalStats>)
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  if (error) return <ErrorState>Couldn&apos;t load your stats. Refresh to try again.</ErrorState>;
  if (!stats) return <Loading>Loading your stats…</Loading>;
  if (stats.gamesPlayed === 0)
    return (
      <Empty>
        <span>
          Finish a Puzzle to start your stats. <Link href="/">Play today&apos;s Puzzle</Link>
        </span>
      </Empty>
    );

  return (
    <div className="stats-view">
      <section className="card stats-grid">
        <div>
          <p className="stat" data-testid="games-played">{stats.gamesPlayed}</p>
          <p className="muted">Games played</p>
        </div>
        <div>
          <p className="stat" data-testid="average-score">{Math.round(stats.averageScore ?? 0)}</p>
          <p className="muted">Average score</p>
        </div>
        <div>
          <p className="stat" data-testid="gems-found">{stats.gemsFound}</p>
          <p className="muted">Gems found</p>
        </div>
        <div>
          <p className="stat" data-testid="best-day">{stats.bestDay?.total ?? 0}</p>
          <p className="muted">
            Best day{stats.bestDay && <> (<span className="num">{stats.bestDay.puzzleDay}</span>)</>}
          </p>
        </div>
      </section>
      <section className="card">
        <h3>Tiers</h3>
        <ul className="answer-set">
          {TIERS.map((tier) => (
            <li key={tier} className={`tone-${tierTone(tier)}`}>
              <span>
                {TIER_EMOJI[tier]} {TIER_NAMES[tier]}
              </span>
              <span className="num">{stats.tierCounts[tier]}</span>
            </li>
          ))}
          <li className="tone-miss">
            <span>{MISS_EMOJI} Miss</span>
            <span className="num">{stats.tierCounts.miss}</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
