import { getAllSongs } from "@/lib/songs";
import Header from "@/components/Header";
import SongGallery from "@/components/SongGallery";

export default function Home() {
  const songs = getAllSongs();

  return (
    <>
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero section */}
        <div className="mb-8">
          <h2
            className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-2"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Browse Notations
          </h2>
          <p className="text-[var(--text-muted)] text-sm sm:text-base">
            {songs.length} songs with sargam notations for flute, harmonium &amp; more
          </p>
        </div>

        <SongGallery songs={songs} />
      </main>
    </>
  );
}
