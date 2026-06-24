import Link from "next/link";
import Image from "next/image";
import type { SpotifyAttribution } from "@/types/song";

interface SpotifyImageProps {
  /** URL to Spotify-hosted album art image */
  imageUrl: string;
  /** Spotify attribution data (track URL, artists, album) */
  attribution: SpotifyAttribution;
  /** Song or album title for alt text */
  alt?: string;
  /** CSS class name */
  className?: string;
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
}

/**
 * Displays a Spotify album art image with proper attribution and branding.
 * 
 * COMPLIANCE:
 * - Links directly to Spotify-hosted image (never downloaded)
 * - Displays Spotify logo and attribution
 * - Includes link to track on Spotify
 * - Keeps image in original form
 * 
 * @param props Image URL, attribution, styling
 * @returns Component with image, Spotify logo, and track link
 */
export default function SpotifyImage({
  imageUrl,
  attribution,
  alt = "Album cover",
  className = "",
  width = 300,
  height = 300,
}: SpotifyImageProps) {
  return (
    <div className={`relative group ${className}`}>
      {/* Image container */}
      <Link
        href={attribution.trackUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative overflow-hidden rounded-lg bg-gray-100"
      >
        <Image
          src={imageUrl}
          alt={alt}
          width={width}
          height={height}
          className="w-full h-auto object-cover group-hover:opacity-90 transition-opacity"
          sizes={`${width}px`}
        />

        {/* Hover overlay with Spotify branding */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <svg
              className="w-12 h-12 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              {/* Spotify logo */}
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.122-.899-.539-.12-.417.122-.776.539-.897 4.561-1.12 8.52-.501 11.521 1.32.418.24.479.659.301 1.02zm1.44-3.3c-.301.46-.841.557-1.3.299-3.3-2.04-8.159-2.639-12.018-1.439-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.06 9.649 14.3 10.357 17.961 12.98c.361.181.54.78.241 1.12zm.12-3.36C15.24 8.08 8.7 7.919 5.359 9.72c-.6.301-1.201-.06-1.44-.66-.239-.601.061-1.2.66-1.44 3.907-2.049 10.982-1.848 15.321 2.041.5.301.659 1.020.301 1.561-.301.48-1.021.599-1.561.3z" />
            </svg>
          </div>
        </div>
      </Link>

      {/* Attribution info below image */}
      <div className="mt-2 text-xs text-gray-600">
        <div className="font-semibold text-gray-900 truncate">
          {attribution.album}
        </div>
        <div className="truncate">{attribution.artists.join(", ")}</div>
        <div className="text-gray-500">{attribution.releaseDate}</div>

        {/* Spotify link with logo */}
        <Link
          href={attribution.trackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-spotify-green hover:opacity-80 transition-opacity"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.122-.899-.539-.12-.417.122-.776.539-.897 4.561-1.12 8.52-.501 11.521 1.32.418.24.479.659.301 1.02zm1.44-3.3c-.301.46-.841.557-1.3.299-3.3-2.04-8.159-2.639-12.018-1.439-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.06 9.649 14.3 10.357 17.961 12.98c.361.181.54.78.241 1.12zm.12-3.36C15.24 8.08 8.7 7.919 5.359 9.72c-.6.301-1.201-.06-1.44-.66-.239-.601.061-1.2.66-1.44 3.907-2.049 10.982-1.848 15.321 2.041.5.301.659 1.020.301 1.561-.301.48-1.021.599-1.561.3z" />
          </svg>
          <span>View on Spotify</span>
        </Link>
      </div>
    </div>
  );
}
