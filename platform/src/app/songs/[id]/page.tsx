import { notFound } from "next/navigation";
import { getAllSongs, getSongById } from "@/lib/songs";
import SongViewer from "@/components/SongViewer";

// Generate static params for all songs at build time
export async function generateStaticParams() {
  const songs = getAllSongs();
  return songs.map((song) => ({
    id: song.id,
  }));
}

// Generate metadata for each song page
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const song = getSongById(id);

  if (!song) {
    return { title: "Song Not Found | Songbook" };
  }

  return {
    title: `${song.title} | Songbook`,
    description: `Sargam notation for ${song.title}. ${song.info.join(". ")}`,
  };
}

export default async function SongPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const song = getSongById(id);

  if (!song) {
    notFound();
  }

  return <SongViewer song={song} />;
}
