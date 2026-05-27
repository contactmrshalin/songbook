"use client";

import { useEffect } from "react";
import { ADSENSE_PUBLISHER_ID, isAdSenseConfigured } from "@/lib/ads.config";

/**
 * Dynamically loads the AdSense script on the client side.
 * This avoids embedding the script in the initial HTML, which prevents
 * crashes in Android WebView (Google blocks AdSense in app WebViews).
 */
export default function AdSenseLoader() {
  useEffect(() => {
    if (!isAdSenseConfigured()) return;

    // Skip loading in WebView contexts (Android WebView, iOS WKWebView)
    const ua = navigator.userAgent;
    if (/wv\)|WebView/i.test(ua)) return;

    // Check if script already loaded
    if (document.querySelector('script[src*="pagead2.googlesyndication.com"]')) return;

    const script = document.createElement("script");
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => {
      // AdSense blocked (ad blocker) — fail silently
    };
    document.head.appendChild(script);
  }, []);

  return null;
}
