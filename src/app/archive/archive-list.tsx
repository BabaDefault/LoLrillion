"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ArchiveEntryView } from "@/server/game-service";
import { Empty, ErrorState, Loading } from "../status";

/**
 * Past Puzzles, newest first. Today's Puzzle is never listed; upcoming ones are listed first only
 * while the beta's play-ahead is on.
 */
export function ArchiveList() {
  const [days, setDays] = useState<ArchiveEntryView[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/archive", { cache: "no-store" })
      .then((res) => res.json() as Promise<{ days: ArchiveEntryView[] }>)
      .then((res) => setDays(res.days))
      .catch(() => setError(true));
  }, []);

  if (error) return <ErrorState>Couldn&apos;t load the archive. Refresh to try again.</ErrorState>;
  if (!days) return <Loading>Loading the archive…</Loading>;
  if (days.length === 0) return <Empty>No past Puzzles yet. Come back tomorrow.</Empty>;

  return (
    <ul className="archive-list">
      {days.map((day) => (
        <li key={day.puzzleDay}>
          <Link href={`/archive/${day.puzzleDay}`} className="card row">
            <span>
              LoLrillion <span className="num">#{day.puzzleNumber}</span>{" "}
              <span className="muted">
                · <span className="num">{day.puzzleDay}</span>
                {day.upcoming && " · Upcoming"}
              </span>
            </span>
            <span className={day.finished ? "muted" : "chip"}>{day.finished ? "Results" : day.upcoming ? "Play early" : "Play"}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
