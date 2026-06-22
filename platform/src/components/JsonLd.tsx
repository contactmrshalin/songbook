import type { Song } from "@/types/song";

interface JsonLdProps {
  song?: Song;
  type: "website" | "song";
}

export default function JsonLd({ song, type }: JsonLdProps) {
  if (type === "website") {
    const schema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Songbook",
      url: "https://songnotations.vercel.app",
      description:
        "Free sargam notations for 190+ Bollywood and Indian classical songs.",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://songnotations.vercel.app/?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    };

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    );
  }

  if (type === "song" && song) {
    const schema = {
      "@context": "https://schema.org",
      "@type": "MusicComposition",
      name: song.title,
      description: `Sargam notation for ${song.title}. ${song.info.join(". ")}`,
      url: `https://songnotations.vercel.app/songs/${song.id}`,
      inLanguage: "hi",
      genre: "Bollywood",
      isPartOf: {
        "@type": "MusicPlaylist",
        name: "Songbook Notation Collection",
        url: "https://songnotations.vercel.app",
      },
    };

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    );
  }

  return null;
}
