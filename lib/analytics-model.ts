export const ANALYTICS_RETENTION_DAYS = 400;
export const ANALYTICS_SESSION_IDLE_MS = 30 * 60 * 1000;

export const ANALYTICS_ACTIONS = [
  "archive.enter", "video.open", "gallery.open", "bulletin.open",
  "bulletin.download", "business.open", "business.external", "signup.complete",
] as const;
export type AnalyticsAction = typeof ANALYTICS_ACTIONS[number];
export type AnalyticsKind = "pageview" | "engagement" | AnalyticsAction;
export type AnalyticsPeriod = "today" | "yesterday" | "week" | "month" | "year" | "all" | "custom";

export type AnalyticsEventInput = {
  id: string;
  kind: AnalyticsKind;
  path: string;
  contentType?: string;
  contentId?: string;
  engagementMs?: number;
};

export const actionLabels: Record<AnalyticsAction, string> = {
  "archive.enter": "예배 아카이브 진입",
  "video.open": "예배·설교 영상 열기",
  "gallery.open": "갤러리 상세 열기",
  "bulletin.open": "주보 열람",
  "bulletin.download": "주보 다운로드",
  "business.open": "성도사업장 상세 열기",
  "business.external": "성도사업장 외부 링크",
  "signup.complete": "회원가입 완료",
};

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
});

export function koreaClock(value: Date) {
  const parts = Object.fromEntries(dateFormatter.formatToParts(value).map((part) => [part.type, part.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return { day, hour: Number(parts.hour), weekday: (weekday + 6) % 7 };
}

export function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function shiftDay(day: string, days: number) {
  const value = new Date(`${day}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function daySpan(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

export function periodRange(period: AnalyticsPeriod, today: string, collected: string, customStart?: string, customEnd?: string) {
  let start = today;
  let end = today;
  if (period === "yesterday") start = end = shiftDay(today, -1);
  if (period === "week") start = shiftDay(today, -koreaClock(new Date(`${today}T12:00:00+09:00`)).weekday);
  if (period === "month") start = `${today.slice(0, 7)}-01`;
  if (period === "year") start = `${today.slice(0, 4)}-01-01`;
  if (period === "all") start = collected;
  if (period === "custom") {
    if (!customStart || !customEnd || !validDay(customStart) || !validDay(customEnd)) throw new Error("invalid-range");
    start = customStart;
    end = customEnd;
  }
  if (!validDay(start) || !validDay(end) || start > end || daySpan(start, end) > 3653 || end > today) throw new Error("invalid-range");
  const days = daySpan(start, end);
  return { start, end, previousStart: shiftDay(start, -days), previousEnd: shiftDay(start, -1), days };
}

export function normalizeAnalyticsPath(input: string) {
  if (!input.startsWith("/") || input.startsWith("//") || input.length > 160) return null;
  const path = input.replace(/\/+$/, "") || "/";
  if (/^\/(?:admin|api|member|privacy)(?:\/|$)/.test(path) || /^\/archive\/admin(?:\/|$)/.test(path)) return null;
  if (["/", "/about", "/worship", "/sermons", "/bulletin", "/news", "/business", "/gallery", "/archive", "/archive/sunday", "/archive/other", "/archive/attendance", "/archive/songs"].includes(path)) return path;
  const detail = path.match(/^\/(bulletin|news|business|gallery)\/[a-zA-Z0-9_-]{1,64}$/);
  if (detail) return `/${detail[1]}/detail`;
  return null;
}

export function sanitizeCampaign(value: unknown) {
  if (typeof value !== "string") return "";
  const candidate = value.trim().slice(0, 40);
  return /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(candidate) ? candidate.toLowerCase() : "";
}

export function sanitizeReferrerHost(value: unknown) {
  if (typeof value !== "string" || value.length > 160) return "";
  let host = value.trim().toLowerCase();
  if (host.startsWith("https://") || host.startsWith("http://")) {
    try { host = new URL(host).hostname; } catch { return ""; }
  }
  if (!/^(?:[a-z0-9-]+\.)+[a-z]{2,24}$/.test(host)) return "";
  if (host === "mhji.kr" || host.endsWith(".mhji.kr")) return "";
  const labels = host.split(".");
  const suffixLength = labels.at(-1) === "kr" && ["co", "or", "ac"].includes(labels.at(-2) ?? "") ? 3 : 2;
  return labels.slice(-suffixLength).join(".");
}

export function classifySource(referrerHost: string, utmSource: string, utmMedium: string) {
  const source = utmSource || referrerHost;
  if (/google|naver|bing|daum/.test(source) && !/youtube/.test(source)) return { category: "search", label: /naver/.test(source) ? "네이버" : /google/.test(source) ? "구글" : /daum/.test(source) ? "다음" : "빙" };
  if (/youtube|kakao|facebook|instagram|threads|twitter|x\.com/.test(source) || /social|sns/.test(utmMedium)) return { category: "sns", label: /youtube/.test(source) ? "유튜브" : /kakao/.test(source) ? "카카오" : source || "SNS" };
  if (referrerHost) return { category: "external", label: referrerHost };
  if (utmSource || utmMedium) return { category: "other", label: utmSource || utmMedium };
  return { category: "direct", label: "직접/출처 미확인" };
}

export function classifyDevice(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const device = /ipad|tablet|sm-t|tab\b/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua)) ? "tablet" : /mobi|iphone|android/.test(ua) ? "mobile" : "desktop";
  const browser = /samsungbrowser/.test(ua) ? "Samsung Internet" : /edg\//.test(ua) ? "Edge" : /whale\//.test(ua) ? "Whale" : /firefox\//.test(ua) ? "Firefox" : /chrome\//.test(ua) ? "Chrome" : /safari\//.test(ua) ? "Safari" : "알 수 없음";
  const os = /android/.test(ua) ? "Android" : /iphone|ipad|ipod/.test(ua) ? "iOS/iPadOS" : /windows/.test(ua) ? "Windows" : /mac os/.test(ua) ? "macOS" : /linux/.test(ua) ? "Linux" : "알 수 없음";
  return { device, browser, os };
}

export function isLikelyAutomation(userAgent: string) {
  return !userAgent || /bot|crawler|spider|headless|playwright|lighthouse|curl|wget|python-requests|axios|uptime|monitoring/i.test(userAgent);
}

export function parseAnalyticsEvents(value: unknown): AnalyticsEventInput[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) return null;
  const allowed = new Set<string>(["pageview", "engagement", ...ANALYTICS_ACTIONS]);
  const events: AnalyticsEventInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Record<string, unknown>;
    const path = typeof candidate.path === "string" ? normalizeAnalyticsPath(candidate.path) : null;
    if (typeof candidate.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(candidate.id) || !allowed.has(String(candidate.kind)) || !path) return null;
    const contentType = typeof candidate.contentType === "string" && /^(?:video|gallery|bulletin|business)$/.test(candidate.contentType) ? candidate.contentType : "";
    const contentId = typeof candidate.contentId === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(candidate.contentId) ? candidate.contentId : "";
    const engagementMs = candidate.kind === "engagement" && typeof candidate.engagementMs === "number" && Number.isFinite(candidate.engagementMs) ? Math.max(0, Math.min(600_000, Math.round(candidate.engagementMs))) : 0;
    events.push({ id: candidate.id, kind: candidate.kind as AnalyticsKind, path, contentType, contentId, engagementMs });
  }
  return events;
}
