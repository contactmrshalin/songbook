import { notFound } from "next/navigation";
import { getAllSongs, getSongById } from "@/lib/songs";
import SongViewer from "@/components/SongViewer";
import JsonLd from "@/components/JsonLd";
import type { Song } from "@/types/song";

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

  const description = `Sargam notation for ${song.title}. ${song.info.join(". ")}`;
  const url = `https://songnotations.vercel.app/songs/${id}`;

  return {
    title: `${song.title} – Sargam Notation | Songbook`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${song.title} – Sargam Notation`,
      description,
      url,
      siteName: "Songbook",
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `${song.title} – Sargam Notation`,
      description,
    },
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

  const otherSongs: Song[] = getAllSongs().filter((s) => s.id !== id);

  return (
    <>
      <JsonLd type="song" song={song} />
      <SongViewer song={song} otherSongs={otherSongs} />
    </>
  );
}
