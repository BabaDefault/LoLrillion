import { PlayScreen } from "../../play-screen";

export default async function ArchivePlayPage({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  return (
    <>
      <h1 className="title">Archive · {day}</h1>
      <PlayScreen archiveDay={day} />
    </>
  );
}
