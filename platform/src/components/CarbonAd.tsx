"use client";

import { useEffect, useRef } from "react";

/**
 * Carbon Ads — ethical, developer-focused ad network.
 * Sign up at https://www.carbonads.net/ and replace the serve/placement values.
 *
 * Alternative options if Carbon doesn't approve:
 * - Media.net: https://www.media.net/ (contextual ads, Yahoo/Bing network)
 * - Adsterra: https://adsterra.com/ (no minimum traffic, instant approval)
 * - PropellerAds: https://propellerads.com/ (push/native ads, instant approval)
 */

interface CarbonAdProps {
  className?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Replace these with your actual Carbon Ads values after approval
// Get them from: https://www.carbonads.net/
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CARBON_SERVE = ""; // e.g., "CESI42QE"
const CARBON_PLACEMENT = ""; // e.g., "songnotationsvercelapp"

export function isCarbonConfigured(): boolean {
  return CARBON_SERVE.length > 0 && CARBON_PLACEMENT.length > 0;
}

export default function CarbonAd({ className = "" }: CarbonAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCarbonConfigured()) return;
    if (!containerRef.current) return;

    // Only load once
    if (containerRef.current.querySelector("script")) return;

    const script = document.createElement("script");
    script.src = `//cdn.carbonads.com/carbon.js?serve=${CARBON_SERVE}&placement=${CARBON_PLACEMENT}`;
    script.id = "_carbonads_js";
    script.async = true;
    containerRef.current.appendChild(script);
  }, []);

  if (!isCarbonConfigured()) return null;

  return <div ref={containerRef} className={`carbon-ad-wrapper ${className}`} />;
}
