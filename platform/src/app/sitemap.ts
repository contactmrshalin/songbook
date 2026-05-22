import type { MetadataRoute } from "next";
import { getAllSongs } from "@/lib/songs";

const BASE_URL = "https://songnotations.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const songs = getAllSongs();

  const songEntries: MetadataRoute.Sitemap = songs.map((song) => ({
    url: `${BASE_URL}/songs/${song.id}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...songEntries,
  ];
}
