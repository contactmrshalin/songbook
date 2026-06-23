"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AD_PROVIDER_HOOK_SCRIPT_PATH,
  AD_RUNTIME_MODE,
  ADSENSE_PUBLISHER_ID,
  AD_FALLBACK_PROVIDER,
  getPlannedFallbackProviderLabel,
  shouldUseFallbackHookRuntime,
} from "@/lib/ads.config";

type SlotInfo = {
  slot: string;
  status: string;
  width: string;
  height: string;
};

type Diagnostics = {
  checkedAt: string;
  host: string;
  runtimeMode: string;
  hookRuntimeEnabled: boolean;
  hookScriptPath: string;
  hookScriptPresent: boolean;
  fallbackProvider: string;
  fallbackProviderLabel: string;
  adsTxtStatus: string;
  adsTxtContainsPublisher: boolean;
  adsTxtPreview: string;
  homeHasPublisherMeta: boolean;
  homeAdSlotCount: number;
  pageHasPublisherMeta: boolean;
  adScriptPresent: boolean;
  adsbygoogleArrayPresent: boolean;
  slotCount: number;
  slotsByStatus: Record<string, number>;
  slotSamples: SlotInfo[];
  adIframeCount: number;
  adIframeSamples: string[];
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function countByStatus(slots: SlotInfo[]): Record<string, number> {
  return slots.reduce<Record<string, number>>((acc, slot) => {
    const key = slot.status || "pending";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export default function AdsDiagnosticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [report, setReport] = useState<Diagnostics | null>(null);

  const runChecks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [adsTxtRes, homeRes] = await Promise.all([
        fetch("/ads.txt", { cache: "no-store" }),
        fetch("/", { cache: "no-store" }),
      ]);

      const adsTxtText = adsTxtRes.ok ? (await adsTxtRes.text()).trim() : "";
      const homeHtml = homeRes.ok ? await homeRes.text() : "";

      const pageMeta = document.querySelector('meta[name="google-adsense-account"]');
      const adScript = document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
      const hookScript = document.querySelector('script[data-ad-provider-hook="true"]');

      const slotNodes = Array.from(document.querySelectorAll("ins.adsbygoogle"));
      const slots: SlotInfo[] = slotNodes.map((node) => ({
        slot: node.getAttribute("data-ad-slot") || "(missing)",
        status: node.getAttribute("data-ad-status") || "pending",
        width: getComputedStyle(node).width,
        height: getComputedStyle(node).height,
      }));

      const iframes = Array.from(document.querySelectorAll("iframe"))
        .map((f) => f.getAttribute("src") || "")
        .filter((src) => /googleads|doubleclick|googlesyndication|adtrafficquality|google\.com/i.test(src));

      const homeAdSlotCount = (homeHtml.match(/data-ad-slot=/g) || []).length;
      const homeHasPublisherMeta = homeHtml.includes(`google-adsense-account\" content=\"${ADSENSE_PUBLISHER_ID}`);

      const data: Diagnostics = {
        checkedAt: new Date().toISOString(),
        host: window.location.host,
        runtimeMode: AD_RUNTIME_MODE,
        hookRuntimeEnabled: shouldUseFallbackHookRuntime(),
        hookScriptPath: AD_PROVIDER_HOOK_SCRIPT_PATH,
        hookScriptPresent: Boolean(hookScript),
        fallbackProvider: AD_FALLBACK_PROVIDER,
        fallbackProviderLabel: getPlannedFallbackProviderLabel(),
        adsTxtStatus: String(adsTxtRes.status),
        adsTxtContainsPublisher: adsTxtText.includes("pub-6628890818019640"),
        adsTxtPreview: adsTxtText || "(empty)",
        homeHasPublisherMeta,
        homeAdSlotCount,
        pageHasPublisherMeta:
          pageMeta?.getAttribute("content") === ADSENSE_PUBLISHER_ID,
        adScriptPresent: Boolean(adScript),
        adsbygoogleArrayPresent: typeof window.adsbygoogle !== "undefined",
        slotCount: slots.length,
        slotsByStatus: countByStatus(slots),
        slotSamples: slots.slice(0, 8),
        adIframeCount: iframes.length,
        adIframeSamples: iframes.slice(0, 6),
      };

      setReport(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const summary = useMemo(() => {
    if (!report) return "Running checks...";

    const problems: string[] = [];
    if (report.adsTxtStatus !== "200") problems.push("ads.txt not reachable");
    if (!report.adsTxtContainsPublisher) problems.push("publisher missing in ads.txt");
    if (!report.pageHasPublisherMeta) problems.push("missing page meta tag");
    if (!report.homeHasPublisherMeta) problems.push("home HTML missing adsense meta");
    if (!report.adScriptPresent) problems.push("AdSense script not present yet");

    return problems.length === 0 ? "Core checks look good" : problems.join(" | ");
  }, [report]);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-semibold mb-2">AdSense Diagnostics</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Public diagnostics for live AdSense integration checks.
      </p>

      <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4 mb-4">
        <p className="text-sm">
          <strong>Summary:</strong> {summary}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Publisher: {ADSENSE_PUBLISHER_ID}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Planned fallback (scaffold only): {report?.fallbackProviderLabel || getPlannedFallbackProviderLabel()} ({report?.fallbackProvider || AD_FALLBACK_PROVIDER})
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Runtime mode: {report?.runtimeMode || AD_RUNTIME_MODE} | hook enabled: {String(report?.hookRuntimeEnabled ?? shouldUseFallbackHookRuntime())}
        </p>
      </div>

      <button
        type="button"
        className="px-4 py-2 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] text-sm mb-6"
        onClick={() => void runChecks()}
        disabled={loading}
      >
        {loading ? "Checking..." : "Refresh checks"}
      </button>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 text-red-700 p-4 mb-4 text-sm">
          Check failed: {error}
        </div>
      )}

      {report && (
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4">
            <h2 className="font-medium mb-2">Crawl-style checks</h2>
            <ul className="space-y-1">
              <li>Host: {report.host}</li>
              <li>Fallback scaffold: {report.fallbackProviderLabel}</li>
              <li>Runtime mode: {report.runtimeMode}</li>
              <li>Hook script path: {report.hookScriptPath}</li>
              <li>Hook script present: {String(report.hookScriptPresent)}</li>
              <li>ads.txt status: {report.adsTxtStatus}</li>
              <li>ads.txt contains publisher: {String(report.adsTxtContainsPublisher)}</li>
              <li>Home HTML has adsense meta: {String(report.homeHasPublisherMeta)}</li>
              <li>Home HTML ad slot markers: {report.homeAdSlotCount}</li>
            </ul>
            <p className="text-xs text-[var(--text-muted)] mt-2 break-all">
              ads.txt preview: {report.adsTxtPreview}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4">
            <h2 className="font-medium mb-2">Browser-runtime checks</h2>
            <ul className="space-y-1">
              <li>Page has adsense meta: {String(report.pageHasPublisherMeta)}</li>
              <li>AdSense script present: {String(report.adScriptPresent)}</li>
              <li>window.adsbygoogle available: {String(report.adsbygoogleArrayPresent)}</li>
              <li>Detected ad slots on this page: {report.slotCount}</li>
              <li>Detected ad iframes: {report.adIframeCount}</li>
              <li>Checked at: {report.checkedAt}</li>
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4">
            <h2 className="font-medium mb-2">Slot status breakdown</h2>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(report.slotsByStatus, null, 2)}
            </pre>
          </div>

          <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4">
            <h2 className="font-medium mb-2">Slot samples</h2>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(report.slotSamples, null, 2)}
            </pre>
          </div>

          <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4">
            <h2 className="font-medium mb-2">Ad iframe samples</h2>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(report.adIframeSamples, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </main>
  );
}
