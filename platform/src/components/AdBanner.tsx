"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_PUBLISHER_ID, isAdSenseConfigured } from "@/lib/ads.config";

interface AdBannerProps {
  /** AdSense ad slot ID */
  slot: string;
  /** Ad format — "auto" for responsive, or explicit like "rectangle" */
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  /** Whether the ad should be full-width responsive */
  responsive?: boolean;
  /** Additional CSS class names for the container */
  className?: string;
  /** Layout style (for in-feed or in-article ads) */
  layout?: "in-article" | "in-feed" | "";
  /** Layout key for in-feed ads (from AdSense) */
  layoutKey?: string;
}

/**
 * Google AdSense ad unit component.
 *
 * Renders a responsive ad banner that loads via the AdSense script.
 * Falls back to nothing when AdSense isn't configured (dev mode).
 */
export default function AdBanner({
  slot,
  format = "auto",
  responsive = true,
  className = "",
  layout = "",
  layoutKey,
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const isLoaded = useRef(false);

  useEffect(() => {
    if (!isAdSenseConfigured()) return;
    if (isLoaded.current) return;

    try {
      const adsbygoogle = (window as unknown as Record<string, unknown[]>)
        .adsbygoogle;
      if (adsbygoogle) {
        adsbygoogle.push({});
        isLoaded.current = true;
      }
    } catch {
      // AdSense not loaded or blocked by ad blocker — fail silently
    }
  }, []);

  // Don't render anything if AdSense isn't configured
  if (!isAdSenseConfigured()) {
    return (
      <div className={`ad-placeholder ${className}`}>
        <div
          className="flex items-center justify-center rounded-lg border-2 border-dashed
                      border-[var(--border-light)] bg-[var(--bg-secondary)]/50 py-4 px-6
                      text-xs text-[var(--text-muted)]"
        >
          Ad Space — Configure your AdSense Publisher ID in{" "}
          <code className="mx-1 px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-[10px]">
            src/lib/ads.config.ts
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className={`ad-container ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block", minHeight: 0 }}
        data-ad-client={ADSENSE_PUBLISHER_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
        {...(layout ? { "data-ad-layout": layout } : {})}
        {...(layoutKey ? { "data-ad-layout-key": layoutKey } : {})}
      />
    </div>
  );
}
