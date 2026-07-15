import { notFound } from "next/navigation";
import { getAllSongs, getSongById } from "@/lib/songs";

import { getGitHubRepoConfig } from "@/lib/github-config";
import SongViewer from "@/components/SongViewer";
import JsonLd from "@/components/JsonLd";
import { getSiteUrl } from "@/lib/site.config";
import type { Song } from "@/types/song";

export const dynamicParams = true;

async function getSongByIdWithLiveFallback(id: string): Promise<Song | undefined> {
  const bundled = getSongById(id);
  if (bundled) {
    return bundled;
  }

  try {
    const { rawBaseUrl } = getGitHubRepoConfig();
    const res = await fetch(`${rawBaseUrl}/data/songs/${id}.json`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return undefined;
    }

    const liveSong: Song = await res.json();
    return liveSong.export === false ? undefined : liveSong;
  } catch {
    return undefined;
  }
}

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

  const song = await getSongByIdWithLiveFallback(id);

  if (!song) {
    return { title: "Song Not Found | Songbook" };
  }

  const description = `Sargam notation for ${song.title}. ${song.info.join(". ")}`;
  const url = getSiteUrl(`/songs/${id}`);

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

  const song = await getSongByIdWithLiveFallback(id);

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
