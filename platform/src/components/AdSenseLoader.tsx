"use client";

import { useEffect } from "react";
import {
  AD_FALLBACK_PROVIDER,
  AD_PROVIDER_HOOK_SCRIPT_PATH,
  ADSENSE_PUBLISHER_ID,
  isAdSenseConfigured,
  shouldUseFallbackHookRuntime,
} from "@/lib/ads.config";

declare global {
  interface Window {
    songbookAdProviderActivate?: (ctx: { provider: string }) => void;
  }
}

/**
 * Dynamically loads the AdSense script on the client side.
 * This avoids embedding the script in the initial HTML, which prevents
 * crashes in Android WebView (Google blocks AdSense in app WebViews).
 */
export default function AdSenseLoader() {
  useEffect(() => {
    const loadAdSense = () => {
      if (!isAdSenseConfigured()) return;

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
    };

    // Skip loading in WebView contexts (Android WebView, iOS WKWebView)
    const ua = navigator.userAgent;
    if (/wv\)|WebView/i.test(ua)) return;

    if (shouldUseFallbackHookRuntime()) {
      if (document.querySelector('script[data-ad-provider-hook="true"]')) return;

      const hookScript = document.createElement("script");
      hookScript.src = AD_PROVIDER_HOOK_SCRIPT_PATH;
      hookScript.async = true;
      hookScript.dataset.adProviderHook = "true";
      hookScript.onerror = () => {
        // Missing hook file should fail safe to AdSense.
        loadAdSense();
      };
      hookScript.onload = () => {
        if (typeof window.songbookAdProviderActivate === "function") {
          window.songbookAdProviderActivate({ provider: AD_FALLBACK_PROVIDER });
        } else {
          // Hook script loaded but did not expose activation fn; fail safe.
          loadAdSense();
        }
      };
      document.head.appendChild(hookScript);
      return;
    }

    loadAdSense();
  }, []);

  return null;
}
