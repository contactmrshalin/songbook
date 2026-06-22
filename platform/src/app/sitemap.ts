import type { MetadataRoute } from "next";
import { getAllSongs } from "@/lib/songs";
import { SITE_CONFIG } from "@/lib/site.config";

// Force static generation for static export
export const dynamic = "force-static";
export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  const songs = getAllSongs();

  const songEntries: MetadataRoute.Sitemap = songs.map((song) => ({
    url: `${SITE_CONFIG.url}/songs/${song.id}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    {
      url: SITE_CONFIG.url,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_CONFIG.url}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...songEntries,
  ];
}
