import type { Metadata } from "next";
import { PlayScreen } from "../../play-screen";

type Props = { params: Promise<{ day: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { day } = await params;
  return { title: `Archive · ${day}` };
}

export default async function ArchivePlayPage({ params }: Props) {
  const { day } = await params;
  return (
    <>
      <h1 className="title">Archive · {day}</h1>
      <PlayScreen archiveDay={day} />
    </>
  );
}
