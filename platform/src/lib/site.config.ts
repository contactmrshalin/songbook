/**
 * Centralized site configuration
 * Change this single value to switch to a custom domain or different deployment host
 */

export const SITE_CONFIG = {
  /** Primary deployment URL — used in metadata, SEO, and cross-app links */
  url: "https://songnotations.vercel.app",

  /** Site name for OG/schema.org tags */
  name: "Songbook",

  /** Description for SEO */
  description:
    "Free sargam notations for 190+ Bollywood and Indian classical songs",

  /** When deployed to a custom domain, update url above.
   *  Subdomains and relative basePaths will be handled automatically.
   *  Examples:
   *  - "https://songnotations.com" — root domain
   *  - "https://songbook.example.com" — subdomain
   *  - "https://example.com/songbook" — subpath (requires baseURL config in Hugo too)
   */
} as const;

/**
 * Helper to construct absolute URLs for metadata
 * Usage: `getSiteUrl('/songs/my-song')`
 */
export function getSiteUrl(path: string = ""): string {
  return `${SITE_CONFIG.url}${path.startsWith("/") ? path : `/${path}`}`;
}
