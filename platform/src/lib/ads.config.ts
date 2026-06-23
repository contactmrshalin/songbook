/**
 * Google AdSense Configuration
 *
 * ⚠️  SETUP REQUIRED:
 * 1. Sign up at https://www.google.com/adsense/
 * 2. Get your Publisher ID (starts with "ca-pub-")
 * 3. Set NEXT_PUBLIC_ADSENSE_PUBLISHER_ID in your environment
 * 4. Create ad units in AdSense dashboard and update the slot IDs below
 *
 * Optional fallback scaffold (no runtime switch yet):
 * - NEXT_PUBLIC_AD_FALLBACK_PROVIDER=none|propellerads|ezoic
 *   Records your planned fallback target for quick future activation.
 * - NEXT_PUBLIC_AD_RUNTIME_MODE=adsense|hook (default: adsense)
 *   When set to hook, app loads a tiny external hook script and skips AdSense runtime calls.
 * - NEXT_PUBLIC_AD_PROVIDER_HOOK_SCRIPT_PATH=/ad-provider-hook.js
 *   Script added later to activate PropellerAds/Ezoic without component rewrites.
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

export const ADSENSE_PUBLISHER_ID: string =
  process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID || "ca-pub-6628890818019640";

export type FallbackAdProvider = "none" | "propellerads" | "ezoic";

const fallbackProviderFromEnv =
  (process.env.NEXT_PUBLIC_AD_FALLBACK_PROVIDER || "none").toLowerCase();

export const AD_FALLBACK_PROVIDER: FallbackAdProvider =
  fallbackProviderFromEnv === "propellerads" ||
  fallbackProviderFromEnv === "ezoic"
    ? fallbackProviderFromEnv
    : "none";

export type AdRuntimeMode = "adsense" | "hook";

const runtimeModeFromEnv =
  (process.env.NEXT_PUBLIC_AD_RUNTIME_MODE || "adsense").toLowerCase();

export const AD_RUNTIME_MODE: AdRuntimeMode =
  runtimeModeFromEnv === "hook" ? "hook" : "adsense";

export const AD_PROVIDER_HOOK_SCRIPT_PATH: string =
  process.env.NEXT_PUBLIC_AD_PROVIDER_HOOK_SCRIPT_PATH || "/ad-provider-hook.js";

export const PROPELLER_INVOKE_DOMAIN: string =
  process.env.NEXT_PUBLIC_PROPELLER_INVOKE_DOMAIN || "";

/**
 * Scaffold-only signal for planned ad fallback platform.
 * Runtime ad rendering remains AdSense-only for now.
 */
export function getPlannedFallbackProviderLabel(): string {
  if (AD_FALLBACK_PROVIDER === "propellerads") return "PropellerAds";
  if (AD_FALLBACK_PROVIDER === "ezoic") return "Ezoic";
  return "None";
}

/**
 * Runtime hook switch (safe default: false).
 */
export function shouldUseFallbackHookRuntime(): boolean {
  return ADS_CONFIG.enabled && AD_RUNTIME_MODE === "hook" && AD_FALLBACK_PROVIDER !== "none";
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯  Ad Slot IDs — create these in your AdSense dashboard
//     then paste the slot numbers here
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const AD_SLOTS = {
  /** Below song hero — Leaderboard (728×90 or responsive) */
  SONG_TOP: "4763967009",

  /** Between song sections — In-article ad (responsive) */
  SONG_MID: "5300970310",

  /** After notation, before player — Rectangle (336×280 or responsive) */
  SONG_BOTTOM: "5292020002",

  /** Homepage — between song cards in the grid */
  HOME_FEED: "7045296826",

  /** Homepage — top banner below header */
  HOME_TOP: "5237987606",
} as const;

type AdSlotName = keyof typeof AD_SLOTS;

export const PROPELLER_VISIBLE_ZONE_BY_SLOT: Record<AdSlotName, string> = {
  SONG_TOP: process.env.NEXT_PUBLIC_PROPELLER_ZONE_SONG_TOP || "",
  SONG_MID: process.env.NEXT_PUBLIC_PROPELLER_ZONE_SONG_MID || "",
  SONG_BOTTOM: process.env.NEXT_PUBLIC_PROPELLER_ZONE_SONG_BOTTOM || "",
  HOME_FEED: process.env.NEXT_PUBLIC_PROPELLER_ZONE_HOME_FEED || "",
  HOME_TOP: process.env.NEXT_PUBLIC_PROPELLER_ZONE_HOME_TOP || "",
};

export function getPropellerVisibleZoneForAdSlot(adSlot: string): string {
  const matched = (Object.keys(AD_SLOTS) as AdSlotName[]).find(
    (key) => AD_SLOTS[key] === adSlot,
  );
  if (!matched) return "";
  return PROPELLER_VISIBLE_ZONE_BY_SLOT[matched] || "";
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⚙️  Ad display settings
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const ADS_CONFIG = {

  /** Set to false to disable all ads (useful during development) */
  enabled: true,

  /** Insert a mid-content ad after every N sections */
  midContentInterval: 3,

  /** Insert a feed ad after every N song cards on homepage */
  homeFeedInterval: 24,

  /** Hard cap for number of in-feed ads rendered on homepage */
  maxHomeFeedAds: 2,
} as const;

/**
 * Check if the publisher ID has been configured
 */
export function isAdSenseConfigured(): boolean {
  return (
    ADS_CONFIG.enabled &&
    ADSENSE_PUBLISHER_ID !== "ca-pub-XXXXXXXXXXXXXXXX" &&
    ADSENSE_PUBLISHER_ID.startsWith("ca-pub-")
  );
}
