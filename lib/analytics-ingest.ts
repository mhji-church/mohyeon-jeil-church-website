import { getNetlifyDb } from "./netlify-db";
import {
  ANALYTICS_RETENTION_DAYS, ANALYTICS_SESSION_IDLE_MS, classifyDevice, classifySource,
  koreaClock, parseAnalyticsEvents, sanitizeCampaign, sanitizeReferrerHost, shiftDay,
} from "./analytics-model";
import { clearAnalyticsReportCache } from "./analytics-report";
import { normalizeTrustedAnalyticsGeo, type TrustedAnalyticsGeo } from "./analytics-region";

type IngestBody = {
  events?: unknown;
  referrerHost?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
};

export async function ingestAnonymousEvents(visitorKey: string, body: IngestBody, userAgent: string, geo: TrustedAnalyticsGeo = { available: false }, now = new Date()) {
  const events = parseAnalyticsEvents(body.events);
  if (!events) return { accepted: false, reason: "invalid-events" } as const;
  const clock = koreaClock(now);
  const timestamp = now.toISOString();
  const referrerHost = sanitizeReferrerHost(body.referrerHost);
  const utmSource = sanitizeCampaign(body.utmSource);
  const utmMedium = sanitizeCampaign(body.utmMedium);
  const utmCampaign = sanitizeCampaign(body.utmCampaign);
  const source = classifySource(referrerHost, utmSource, utmMedium);
  const device = classifyDevice(userAgent);
  const location = normalizeTrustedAnalyticsGeo(geo);
  const placeholders = events.map(() => "?").join(",");

  const result = await getNetlifyDb().writeTransaction(async (transaction) => {
    const found = await transaction.execute({ sql: `SELECT id FROM analytics_events WHERE id IN (${placeholders})`, args: events.map((event) => event.id) });
    const existing = new Set(found.rows.map((row) => String(row.id)));
    const unseen = events.filter((event) => !existing.has(event.id));
    if (!unseen.length) return { accepted: true, stored: 0 } as const;

    const minuteKey = timestamp.slice(0, 16);
    await transaction.execute({ sql: "INSERT INTO analytics_ingest_limits (visitor_key, minute_key, event_count) VALUES (?, ?, ?) ON CONFLICT(visitor_key, minute_key) DO UPDATE SET event_count = event_count + excluded.event_count", args: [visitorKey, minuteKey, unseen.length] });
    const limit = await transaction.execute({ sql: "SELECT event_count FROM analytics_ingest_limits WHERE visitor_key = ? AND minute_key = ?", args: [visitorKey, minuteKey] });
    if (Number(limit.rows[0]?.event_count ?? 0) > 90) throw new Error("rate-limit");

    const visitor = await transaction.execute({ sql: "SELECT first_seen_at FROM analytics_visitors WHERE visitor_key = ?", args: [visitorKey] });
    const newVisitor = visitor.rows.length === 0;
    if (newVisitor) await transaction.execute({ sql: "INSERT INTO analytics_visitors (visitor_key, first_seen_at, last_seen_at) VALUES (?, ?, ?)", args: [visitorKey, timestamp, timestamp] });
    else await transaction.execute({ sql: "UPDATE analytics_visitors SET last_seen_at = ? WHERE visitor_key = ?", args: [timestamp, visitorKey] });

    const latest = await transaction.execute({ sql: "SELECT id, last_seen_at FROM analytics_sessions WHERE visitor_key = ? ORDER BY last_seen_at DESC LIMIT 1", args: [visitorKey] });
    const last = latest.rows[0];
    const lastSeen = last ? Date.parse(String(last.last_seen_at)) : Number.NaN;
    const newSession = !last || !Number.isFinite(lastSeen) || now.getTime() - lastSeen >= ANALYTICS_SESSION_IDLE_MS;
    const sessionId = newSession ? crypto.randomUUID() : String(last.id);
    const firstPath = unseen.find((event) => event.kind === "pageview")?.path ?? unseen[0].path;
    const lastPath = [...unseen].reverse().find((event) => event.kind === "pageview")?.path;
    if (newSession) {
      await transaction.execute({
        sql: "INSERT INTO analytics_sessions (id, visitor_key, started_at, last_seen_at, day_kst, entry_path, exit_path, country_code, region_code, city_code, geo_status, device_type, browser_name, os_name, source_category, source_domain, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [sessionId, visitorKey, timestamp, timestamp, clock.day, firstPath, lastPath ?? firstPath, location.countryCode, location.regionCode, location.cityCode, location.geoStatus, device.device, device.browser, device.os, source.category, source.label === "직접/출처 미확인" ? "" : referrerHost, utmSource, utmMedium, utmCampaign],
      });
    }

    let pageviews = 0;
    let actions = 0;
    let engagement = 0;
    for (const event of unseen) {
      if (event.kind === "pageview") pageviews += 1;
      else if (event.kind === "engagement") engagement += event.engagementMs ?? 0;
      else actions += 1;
      await transaction.execute({
        sql: "INSERT INTO analytics_events (id, visitor_key, session_id, kind, day_kst, hour_kst, weekday_kst, path, content_type, content_id, engagement_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [event.id, visitorKey, sessionId, event.kind, clock.day, clock.hour, clock.weekday, event.path, event.contentType ?? "", event.contentId ?? "", event.engagementMs ?? 0, timestamp],
      });
    }
    await transaction.execute({ sql: "UPDATE analytics_sessions SET last_seen_at = ?, exit_path = COALESCE(?, exit_path), engagement_ms = engagement_ms + ? WHERE id = ?", args: [timestamp, lastPath ?? null, engagement, sessionId] });
    await transaction.execute({
      sql: "INSERT INTO analytics_daily_totals (day_kst, visitors_first_seen, visits, pageviews, actions, engagement_ms) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(day_kst) DO UPDATE SET visitors_first_seen = visitors_first_seen + excluded.visitors_first_seen, visits = visits + excluded.visits, pageviews = pageviews + excluded.pageviews, actions = actions + excluded.actions, engagement_ms = engagement_ms + excluded.engagement_ms",
      args: [clock.day, Number(newVisitor), Number(newSession), pageviews, actions, engagement],
    });

    // Indexed, bounded cleanup runs only on the first accepted batch each KST day.
    const cleanup = await transaction.execute({ sql: "UPDATE analytics_meta SET value = ? WHERE key = 'last_cleanup_day' AND value <> ?", args: [clock.day, clock.day] });
    if (cleanup.rowsAffected) {
      const cutoffDay = shiftDay(clock.day, -ANALYTICS_RETENTION_DAYS);
      const cutoffTime = `${cutoffDay}T00:00:00.000Z`;
      await transaction.execute({ sql: "DELETE FROM analytics_events WHERE created_at < ?", args: [cutoffTime] });
      await transaction.execute({ sql: "DELETE FROM analytics_sessions WHERE started_at < ?", args: [cutoffTime] });
      await transaction.execute({ sql: "DELETE FROM analytics_visitors WHERE last_seen_at < ?", args: [cutoffTime] });
      await transaction.execute({ sql: "DELETE FROM analytics_ingest_limits WHERE minute_key < ?", args: [shiftDay(clock.day, -2)] });
    }
    return { accepted: true, stored: unseen.length } as const;
  });
  if (result.accepted && result.stored) clearAnalyticsReportCache();
  return result;
}
