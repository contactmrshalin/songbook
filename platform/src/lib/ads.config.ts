/**
 * Google AdSense Configuration
 *
 * ⚠️  SETUP REQUIRED:
 * 1. Sign up at https://www.google.com/adsense/
 * 2. Get your Publisher ID (starts with "ca-pub-")
 * 3. Replace the PUBLISHER_ID below with your actual ID
 * 4. Create ad units in AdSense dashboard and update the slot IDs below
 *
 * Ad placements on song pages:
 * ┌──────────────────────────────┐
 * │        HEADER / NAV          │
 * ├──────────────────────────────┤
 * │        SONG HERO             │
 * ├──────────────────────────────┤
 * │   🔲 AD: Below Hero          │  ← Leaderboard (728×90)
 * ├──────────────────────────────┤
 * │        SECTION 1             │
 * │        SECTION 2             │
 * ├──────────────────────────────┤
 * │   🔲 AD: Mid-Content         │  ← In-article (responsive)
 * ├──────────────────────────────┤
 * │        SECTION 3...          │
 * ├──────────────────────────────┤
 * │   🔲 AD: Bottom              │  ← Rectangle (336×280)
 * ├──────────────────────────────┤
 * │        AUDIO PLAYER          │
 * └──────────────────────────────┘
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔑  Replace this with your actual Google AdSense Publisher ID
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const ADSENSE_PUBLISHER_ID: string = "pub-6628890818019640";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯  Ad Slot IDs — create these in your AdSense dashboard
//     then paste the slot numbers here
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const AD_SLOTS = {
  /** Below song hero — Leaderboard (728×90 or responsive) */
  SONG_TOP: "1234567890",

  /** Between song sections — In-article ad (responsive) */
  SONG_MID: "1234567891",

  /** After notation, before player — Rectangle (336×280 or responsive) */
  SONG_BOTTOM: "1234567892",

  /** Homepage — between song cards in the grid */
  HOME_FEED: "1234567893",

  /** Homepage — top banner below header */
  HOME_TOP: "1234567894",
} as const;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⚙️  Ad display settings
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const ADS_CONFIG = {
  /** Set to false to disable all ads (useful during development) */
  enabled: true,

  /** Insert a mid-content ad after every N sections */
  midContentInterval: 3,

  /** Insert a feed ad after every N song cards on homepage */
  homeFeedInterval: 8,
} as const;

/**
 * Check if the publisher ID has been configured
 */
export function isAdSenseConfigured(): boolean {
  return (
    ADS_CONFIG.enabled &&
    ADSENSE_PUBLISHER_ID !== "pub-6628890818019640" &&
    ADSENSE_PUBLISHER_ID.startsWith("ca-pub-")
  );
}
