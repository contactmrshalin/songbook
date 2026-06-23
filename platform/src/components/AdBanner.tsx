"use client";

import { useEffect, useRef } from "react";
import {
  AD_FALLBACK_PROVIDER,
  ADSENSE_PUBLISHER_ID,
  isAdSenseConfigured,
  shouldUseFallbackHookRuntime,
} from "@/lib/ads.config";

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
  const useHookRuntime = shouldUseFallbackHookRuntime();

  useEffect(() => {

    if (useHookRuntime) return;
    if (!isAdSenseConfigured()) return;
    if (isLoaded.current) return;

    // Ensure adsbygoogle array exists, then push to request an ad
    const tryLoad = () => {
      try {
        const win = window as unknown as Record<string, unknown[]>;
        win.adsbygoogle = win.adsbygoogle || [];
        win.adsbygoogle.push({});
        isLoaded.current = true;
      } catch {
        // AdSense not loaded or blocked by ad blocker — fail silently
      }
    };

    // If the AdSense script hasn't loaded yet, wait for it
    if (typeof (window as unknown as Record<string, unknown>).adsbygoogle !== "undefined") {
      tryLoad();
    } else {
      // Poll briefly for the script to load (max ~3s)
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (typeof (window as unknown as Record<string, unknown>).adsbygoogle !== "undefined") {
          clearInterval(interval);
          tryLoad();
        } else if (attempts > 15) {
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [useHookRuntime]);

  if (useHookRuntime) {
    return (
      <div
        className={`ad-container ${className}`}
        data-ad-provider-slot={slot}
        data-ad-provider={AD_FALLBACK_PROVIDER}
      />
    );
  }

  // Don't render anything if AdSense isn't configured
  if (!isAdSenseConfigured()) {
    return null;
  }

  return (
    <div className={`ad-container ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
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
