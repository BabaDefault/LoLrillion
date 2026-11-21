import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ADMIN_COOKIE, hasAdminAccess } from "@/server/admin-auth";
import { ArchiveList } from "./archive-list";

export const metadata: Metadata = { title: "Archive", robots: { index: false, follow: false } };

/** Admin-only: a 404 unless this browser has unlocked /admin. */
export default async function ArchivePage() {
  if (!hasAdminAccess((await cookies()).get(ADMIN_COOKIE)?.value, process.env)) notFound();
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
