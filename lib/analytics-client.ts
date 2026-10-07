import type { AnalyticsAction, AnalyticsEventInput } from "./analytics-model";

export const ANALYTICS_ACTION_EVENT = "mhji-analytics-action";

export function trackAnalyticsAction(kind: AnalyticsAction, contentType?: string, contentId?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Pick<AnalyticsEventInput, "kind" | "contentType" | "contentId">>(ANALYTICS_ACTION_EVENT, { detail: { kind, contentType, contentId } }));
}
