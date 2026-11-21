import type { Metadata } from "next";
import { ArchiveList } from "./archive-list";

export const metadata: Metadata = { title: "Archive" };

export default function ArchivePage() {
  return (
    <>
      <h1 className="title">Archive</h1>
      <p className="muted">
        Replay past Puzzles with the same rules. Archive plays never count toward that day&apos;s leaderboard or
        Answer Share.
      </p>
      <ArchiveList />
    </>
  );
}
