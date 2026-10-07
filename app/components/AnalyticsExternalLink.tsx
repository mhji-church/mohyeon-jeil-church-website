"use client";

import { trackAnalyticsAction } from "@/lib/analytics-client";

export default function AnalyticsExternalLink({ href, contentId, children, className }: { href: string; contentId: string; children: React.ReactNode; className?: string }) {
  return <a className={className} href={href} target="_blank" rel="noreferrer" onClick={() => trackAnalyticsAction("business.external", "business", contentId)}>{children}</a>;
}
