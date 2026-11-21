import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ADMIN_COOKIE, hasAdminAccess } from "@/server/admin-auth";
import { PlayScreen } from "../../play-screen";

type Props = { params: Promise<{ day: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { day } = await params;
  return { title: `Archive · ${day}`, robots: { index: false, follow: false } };
}

/** Admin-only: a 404 unless this browser has unlocked /admin. */
export default async function ArchivePlayPage({ params }: Props) {
  const [{ day }, jar] = await Promise.all([params, cookies()]);
  if (!hasAdminAccess(jar.get(ADMIN_COOKIE)?.value, process.env)) notFound();
  return (
    <>
      <h1 className="title">Archive · {day}</h1>
      <PlayScreen archiveDay={day} />
    </>
  );
}
