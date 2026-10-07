"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { ANALYTICS_ACTION_EVENT } from "@/lib/analytics-client";
import type { AnalyticsEventInput } from "@/lib/analytics-model";

function isPublicPath(path: string) { return !/^\/(?:admin|api|member)(?:\/|$)/.test(path) && !/^\/archive\/admin(?:\/|$)/.test(path); }
function attribution() {
  const params = new URLSearchParams(window.location.search);
  let referrerHost = "";
  try { referrerHost = document.referrer ? new URL(document.referrer).hostname : ""; } catch { /* no referrer */ }
  return { referrerHost, utmSource: params.get("utm_source") ?? "", utmMedium: params.get("utm_medium") ?? "", utmCampaign: params.get("utm_campaign") ?? "" };
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const queue = useRef<AnalyticsEventInput[]>([]);
  const sending = useRef(false);
  const page = useRef("");
  const visibleSince = useRef<number | null>(null);
  const lastAction = useRef(new Map<string, number>());

  const flush = useCallback(async (beacon = false) => {
    if (sending.current || !queue.current.length) return;
    const batch = queue.current.splice(0, 12);
    const payload = JSON.stringify({ events: batch, ...attribution() });
    if (beacon && navigator.sendBeacon?.("/api/analytics/collect", new Blob([payload], { type: "application/json" }))) return;
    sending.current = true;
    try {
      const response = await fetch("/api/analytics/collect", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: payload, keepalive: beacon });
      if (!response.ok && response.status >= 500) queue.current.unshift(...batch);
    } catch { queue.current.unshift(...batch); }
    finally { sending.current = false; }
  }, []);

  useEffect(() => {
    if (!pathname || !isPublicPath(pathname) || page.current === pathname) return;
    const now = Date.now();
    if (page.current && visibleSince.current && now - visibleSince.current >= 1000) queue.current.push({ id: crypto.randomUUID(), kind: "engagement", path: page.current, engagementMs: Math.min(600_000, now - visibleSince.current) });
    const wasArchive = page.current.startsWith("/archive");
    page.current = pathname;
    queue.current.push({ id: crypto.randomUUID(), kind: "pageview", path: pathname });
    if (pathname.startsWith("/archive") && !wasArchive) queue.current.push({ id: crypto.randomUUID(), kind: "archive.enter", path: pathname });
    visibleSince.current = document.visibilityState === "visible" ? now : null;
    const timer = window.setTimeout(() => void flush(), 1200);
    return () => window.clearTimeout(timer);
  }, [pathname, flush]);

  useEffect(() => {
    const action = (event: Event) => {
      const detail = (event as CustomEvent<Partial<AnalyticsEventInput>>).detail;
      const path = window.location.pathname;
      if (!detail?.kind || (!isPublicPath(path) && detail.kind !== "signup.complete")) return;
      const key = `${detail.kind}:${detail.contentId ?? ""}:${path}`;
      const now = Date.now();
      if (now - (lastAction.current.get(key) ?? 0) < 1500) return;
      lastAction.current.set(key, now);
      queue.current.push({ id: crypto.randomUUID(), kind: detail.kind, path: isPublicPath(path) ? path : "/", contentType: detail.contentType, contentId: detail.contentId } as AnalyticsEventInput);
      if (queue.current.length >= 8) void flush();
    };
    const engagement = () => {
      if (!visibleSince.current || !isPublicPath(page.current)) return;
      const duration = Math.min(600_000, Date.now() - visibleSince.current);
      visibleSince.current = null;
      if (duration >= 1000) queue.current.push({ id: crypto.randomUUID(), kind: "engagement", path: page.current, engagementMs: duration });
    };
    const visibility = () => { if (document.visibilityState === "hidden") { engagement(); void flush(true); } else visibleSince.current = Date.now(); };
    const pageHide = () => { engagement(); void flush(true); };
    window.addEventListener(ANALYTICS_ACTION_EVENT, action);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pageHide);
    const interval = window.setInterval(() => void flush(), 8000);
    return () => { window.removeEventListener(ANALYTICS_ACTION_EVENT, action); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", pageHide); window.clearInterval(interval); };
  }, [flush]);
  return null;
}
