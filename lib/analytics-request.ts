import type { AnalyticsReportOptions } from "./analytics-report";
import type { AnalyticsPeriod } from "./analytics-model";

const periods = new Set<AnalyticsPeriod>(["today", "yesterday", "week", "month", "year", "all", "custom"]);
const grains = new Set<AnalyticsReportOptions["grain"]>(["day", "week", "month", "year"]);
const sources = new Set(["search", "sns", "external", "direct", "other"]);
const devices = new Set(["mobile", "desktop", "tablet"]);

export function parseAnalyticsOptions(url: string): AnalyticsReportOptions | null {
  const params = new URL(url).searchParams;
  const period = params.get("period") ?? "month";
  const grain = params.get("grain") ?? "day";
  const source = params.get("source") ?? "";
  const device = params.get("device") ?? "";
  const country = params.get("country") ?? "";
  if (!periods.has(period as AnalyticsPeriod) || !grains.has(grain as AnalyticsReportOptions["grain"]) || (source && !sources.has(source)) || (device && !devices.has(device)) || (country && !/^[A-Z]{2}$/.test(country))) return null;
  return { period: period as AnalyticsPeriod, grain: grain as AnalyticsReportOptions["grain"], start: params.get("start") ?? undefined, end: params.get("end") ?? undefined, source: source || undefined, device: device || undefined, country: country || undefined };
}
