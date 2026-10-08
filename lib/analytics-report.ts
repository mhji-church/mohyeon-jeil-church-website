import { getNetlifyDb } from "./netlify-db";
import { ANALYTICS_RETENTION_DAYS, koreaClock, periodRange, shiftDay, type AnalyticsPeriod } from "./analytics-model";

type Filter = { source?: string; device?: string; country?: string };
export type AnalyticsReportOptions = Filter & { period: AnalyticsPeriod; start?: string; end?: string; grain: "day" | "week" | "month" | "year" };
type Row = Record<string, unknown>;

const reportCache = new Map<string, { until: number; value: AnalyticsReport }>();
let visitorSummaryCache: { day: string; until: number; value: AnalyticsVisitorSummary } | null = null;
export function clearAnalyticsReportCache() { reportCache.clear(); visitorSummaryCache = null; }
const number = (value: unknown) => Number(value ?? 0) || 0;
const string = (value: unknown) => String(value ?? "");

async function rows(sql: string, args: (string | number)[] = []) {
  return (await getNetlifyDb().prepare(sql).bind(...args).all<Row>()).results;
}

function bucketExpression(column: string, grain: AnalyticsReportOptions["grain"]) {
  if (grain === "week") return `date(${column}, 'weekday 0', '-6 days')`;
  if (grain === "month") return `substr(${column}, 1, 7)`;
  if (grain === "year") return `substr(${column}, 1, 4)`;
  return column;
}

function bucketDay(day: string, grain: AnalyticsReportOptions["grain"]) {
  if (grain === "year") return day.slice(0, 4);
  if (grain === "month") return day.slice(0, 7);
  if (grain === "week") {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    return shiftDay(day, -((weekday + 6) % 7));
  }
  return day;
}

function nextBucket(bucket: string, grain: AnalyticsReportOptions["grain"]) {
  if (grain === "year") return String(Number(bucket) + 1);
  if (grain === "month") return new Date(Date.UTC(Number(bucket.slice(0, 4)), Number(bucket.slice(5, 7)), 1)).toISOString().slice(0, 7);
  return shiftDay(bucket, grain === "week" ? 7 : 1);
}

function bucketEnd(bucket: string, grain: AnalyticsReportOptions["grain"]) {
  const next = nextBucket(bucket, grain);
  return grain === "year" ? `${bucket}-12-31`
    : grain === "month" ? shiftDay(`${next}-01`, -1)
    : shiftDay(next, -1);
}

function conditions(alias: string, filter: Filter) {
  const clauses: string[] = [];
  const args: string[] = [];
  for (const [key, column] of [["source", "source_category"], ["device", "device_type"], ["country", "country_code"]] as const) {
    const value = filter[key];
    if (value) { clauses.push(`${alias}.${column} = ?`); args.push(value); }
  }
  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", args };
}

async function totals(start: string, end: string, filter: Filter, cutoff: string, collectionDay: string) {
  const recentStart = start < cutoff ? cutoff : start;
  const where = conditions("s", filter);
  const { visits, pages } = recentStart <= end ? await sessionPageCounts(recentStart, end, filter) : { visits: {}, pages: {} };
  const newcomers = recentStart <= end ? (await rows(`SELECT COUNT(DISTINCT s.visitor_key) AS total FROM analytics_sessions s JOIN analytics_visitors v ON v.visitor_key = s.visitor_key WHERE s.day_kst BETWEEN ? AND ? AND date(v.first_seen_at, '+9 hours') BETWEEN ? AND ?${where.sql}`, [recentStart, end, recentStart, end, ...where.args]))[0] : {};
  const hasFilter = Boolean(filter.source || filter.device || filter.country);
  const historicEnd = shiftDay(cutoff, -1);
  const historic = !hasFilter && start < cutoff ? (await rows("SELECT COALESCE(SUM(visits),0) AS visits, COALESCE(SUM(pageviews),0) AS pageviews, COALESCE(SUM(visitors_first_seen),0) AS visitors FROM analytics_daily_totals WHERE day_kst BETWEEN ? AND ?", [start, end < historicEnd ? end : historicEnd]))[0] : {};
  const completeHistory = !hasFilter && start < cutoff && start <= collectionDay && end >= cutoff;
  const firstSeenTotal = completeHistory ? (await rows("SELECT COALESCE(SUM(visitors_first_seen), 0) AS visitors FROM analytics_daily_totals WHERE day_kst BETWEEN ? AND ?", [collectionDay, end]))[0] : {};
  const visitorCount = completeHistory ? number(firstSeenTotal?.visitors) : number(visits?.visitors) + number(historic?.visitors);
  const newCount = number(newcomers?.total) + number(historic?.visitors);
  const visitCount = number(visits?.visits) + number(historic?.visits);
  const pageCount = number(pages?.pageviews) + number(historic?.pageviews);
  return {
    visitors: visitorCount, visits: visitCount, pageviews: pageCount, newVisitors: newCount,
    returningVisitors: Math.max(0, visitorCount - newCount), pagesPerVisit: visitCount ? Math.round(pageCount / visitCount * 100) / 100 : 0,
    averageEngagementSeconds: number(visits?.visits) ? Math.round(number(visits?.engagement) / number(visits?.visits) / 1000) : 0,
    visitorsEstimated: start < cutoff && !completeHistory, historicBreakdownUnavailable: start < cutoff,
  };
}

async function sessionPageCounts(start: string, end: string, filter: Filter) {
  const where = conditions("s", filter);
  const visits = (await rows(`SELECT COUNT(*) AS visits, COUNT(DISTINCT s.visitor_key) AS visitors, COALESCE(SUM(s.engagement_ms), 0) AS engagement FROM analytics_sessions s WHERE s.day_kst BETWEEN ? AND ?${where.sql}`, [start, end, ...where.args]))[0];
  const pages = (await rows(`SELECT COUNT(*) AS pageviews FROM analytics_events e JOIN analytics_sessions s ON s.id = e.session_id WHERE e.day_kst BETWEEN ? AND ? AND e.kind = 'pageview'${where.sql}`, [start, end, ...where.args]))[0];
  return { visits, pages };
}

async function trend(start: string, end: string, filter: Filter, cutoff: string, grain: AnalyticsReportOptions["grain"], collectionDay: string) {
  const recentStart = start < cutoff ? cutoff : start;
  const where = conditions("s", filter);
  const bucket = bucketExpression("s.day_kst", grain);
  const eventBucket = bucketExpression("e.day_kst", grain);
  const sessions = recentStart <= end ? await rows(`SELECT ${bucket} AS bucket, COUNT(*) AS visits, COUNT(DISTINCT s.visitor_key) AS visitors FROM analytics_sessions s WHERE s.day_kst BETWEEN ? AND ?${where.sql} GROUP BY bucket ORDER BY bucket`, [recentStart, end, ...where.args]) : [];
  const pages = recentStart <= end ? await rows(`SELECT ${eventBucket} AS bucket, COUNT(*) AS pageviews FROM analytics_events e JOIN analytics_sessions s ON s.id = e.session_id WHERE e.kind = 'pageview' AND e.day_kst BETWEEN ? AND ?${where.sql} GROUP BY bucket ORDER BY bucket`, [recentStart, end, ...where.args]) : [];
  const historic = !filter.source && !filter.device && !filter.country && start < cutoff ? await rows(`SELECT ${bucketExpression("day_kst", grain)} AS bucket, SUM(visits) AS visits, SUM(pageviews) AS pageviews, SUM(visitors_first_seen) AS visitors FROM analytics_daily_totals WHERE day_kst BETWEEN ? AND ? GROUP BY bucket ORDER BY bucket`, [start, end < cutoff ? end : shiftDay(cutoff, -1)]) : [];
  const merged = new Map<string, { bucket: string; visitors: number; visits: number; pageviews: number; estimated: boolean }>();
  for (const row of [...historic, ...sessions, ...pages]) {
    const key = string(row.bucket);
    const point = merged.get(key) ?? { bucket: key, visitors: 0, visits: 0, pageviews: 0, estimated: false };
    point.visitors += number(row.visitors);
    point.visits += number(row.visits);
    point.pageviews += number(row.pageviews);
    point.estimated ||= historic.includes(row);
    merged.set(key, point);
  }
  const points = [];
  for (let bucket = bucketDay(start, grain), last = bucketDay(end, grain); bucket <= last; bucket = nextBucket(bucket, grain)) {
    points.push({ ...(merged.get(bucket) ?? { bucket, visitors: 0, visits: 0, pageviews: 0, estimated: false }), precollection: bucketEnd(bucket, grain) < collectionDay });
  }
  return points;
}

async function groupSessions(start: string, end: string, filter: Filter, expression: string, label: string, limit = 20) {
  const where = conditions("s", filter);
  return (await rows(`SELECT ${expression} AS label, COUNT(DISTINCT s.visitor_key) AS visitors, COUNT(*) AS visits FROM analytics_sessions s WHERE s.day_kst BETWEEN ? AND ?${where.sql} GROUP BY ${expression} ORDER BY visits DESC LIMIT ?`, [start, end, ...where.args, limit])).map((row) => ({ label: string(row.label) || label, visitors: number(row.visitors), visits: number(row.visits) }));
}

export type AnalyticsReport = Awaited<ReturnType<typeof buildAnalyticsReport>>;
export type AnalyticsVisitorSummary = { collectionDay: string; day: string; precollection: boolean; visitors: { today: number; month: number; cumulative: number } };

function formatUpdatedAt(value: unknown) {
  return value ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(string(value))) + " KST" : null;
}

export async function getAnalyticsVisitorSummary(): Promise<AnalyticsVisitorSummary> {
  const day = koreaClock(new Date()).day;
  if (visitorSummaryCache?.day === day && visitorSummaryCache.until > Date.now()) return visitorSummaryCache.value;
  const started = (await rows("SELECT value FROM analytics_meta WHERE key = 'collection_started_at'"))[0]?.value;
  if (!started) throw new Error("analytics-schema-missing");
  const raw = string(started).replace(" ", "T");
  const collectionDay = koreaClock(new Date(raw.endsWith("Z") ? raw : `${raw}Z`)).day;
  const precollection = day < collectionDay;
  const cutoff = shiftDay(day, -ANALYTICS_RETENTION_DAYS);
  const counts = precollection ? null : (await rows(`SELECT
    COUNT(DISTINCT CASE WHEN day_kst = ? THEN visitor_key END) AS today,
    COUNT(DISTINCT CASE WHEN day_kst BETWEEN ? AND ? THEN visitor_key END) AS month,
    COUNT(DISTINCT visitor_key) AS retained_total
    FROM analytics_sessions WHERE day_kst BETWEEN ? AND ?`, [day, `${day.slice(0, 7)}-01`, day, collectionDay < cutoff ? cutoff : collectionDay, day]))[0];
  // Keep the cumulative number aligned with the detailed "all" report after
  // individual sessions expire, without summing daily unique visitors.
  const historic = !precollection && collectionDay < cutoff
    ? (await rows("SELECT COALESCE(SUM(visitors_first_seen), 0) AS visitors FROM analytics_daily_totals WHERE day_kst BETWEEN ? AND ?", [collectionDay, day]))[0]
    : null;
  const value = { collectionDay, day, precollection, visitors: {
    today: number(counts?.today), month: number(counts?.month), cumulative: historic ? number(historic.visitors) : number(counts?.retained_total),
  } };
  visitorSummaryCache = { day, until: Date.now() + 60_000, value };
  return value;
}

async function buildAnalyticsReport(options: AnalyticsReportOptions) {
  const started = (await rows("SELECT value FROM analytics_meta WHERE key = 'collection_started_at'"))[0]?.value;
  if (!started) throw new Error("analytics-schema-missing");
  const startedAt = string(started).replace(" ", "T") + (string(started).includes("Z") ? "" : "Z");
  const collectionDay = koreaClock(new Date(startedAt)).day;
  const today = koreaClock(new Date()).day;
  const range = periodRange(options.period, today, collectionDay, options.start, options.end);
  const cutoff = shiftDay(today, -ANALYTICS_RETENTION_DAYS);
  const precollection = range.end < collectionDay;
  const recentStart = range.start < cutoff ? cutoff : range.start;
  const filter = { source: options.source, device: options.device, country: options.country };
  const metrics = await totals(range.start, range.end, filter, cutoff, collectionDay);
  const previous = options.period === "all" || range.previousEnd < collectionDay ? null : await totals(range.previousStart, range.previousEnd, filter, cutoff, collectionDay);
  const points = await trend(range.start, range.end, filter, cutoff, options.grain, collectionDay);
  const where = conditions("s", filter);
  const detailAvailable = recentStart <= range.end && !precollection;
  const pages = detailAvailable ? (await rows(`SELECT e.path AS label, e.content_id AS contentId, COALESCE(post.title, '') AS title, COUNT(*) AS pageviews, COUNT(DISTINCT e.visitor_key) AS visitors FROM analytics_events e JOIN analytics_sessions s ON s.id = e.session_id LEFT JOIN content_posts post ON e.path = '/gallery/detail' AND e.content_id = post.id AND post.type = 'gallery' WHERE e.kind = 'pageview' AND e.day_kst BETWEEN ? AND ?${where.sql} GROUP BY e.path, e.content_id ORDER BY pageviews DESC LIMIT 20`, [recentStart, range.end, ...where.args])).map((row) => ({ label: string(row.label), contentId: string(row.contentId), title: string(row.title), pageviews: number(row.pageviews), visitors: number(row.visitors) })) : [];
  const previousPageRows = previous && range.previousEnd >= cutoff ? await rows(`SELECT e.path AS label, e.content_id AS contentId, COUNT(*) AS pageviews FROM analytics_events e JOIN analytics_sessions s ON s.id = e.session_id WHERE e.kind = 'pageview' AND e.day_kst BETWEEN ? AND ?${where.sql} GROUP BY e.path, e.content_id`, [range.previousStart < cutoff ? cutoff : range.previousStart, range.previousEnd, ...where.args]) : [];
  const pageKey = (path: string, id: string) => `${path}:${id}`;
  const previousPageviews = new Map(previousPageRows.map((row) => [pageKey(string(row.label), string(row.contentId)), number(row.pageviews)]));
  const pageChanges = previousPageRows.length ? pages.map((row) => ({ label: row.label, contentId: row.contentId, current: row.pageviews, previous: previousPageviews.get(pageKey(row.label, row.contentId)) ?? 0, difference: row.pageviews - (previousPageviews.get(pageKey(row.label, row.contentId)) ?? 0) })) : [];
  const actions = detailAvailable ? (await rows(`SELECT e.kind AS kind, e.content_type AS contentType, e.content_id AS contentId, COALESCE(post.title, video.title, '') AS title, COUNT(*) AS total FROM analytics_events e JOIN analytics_sessions s ON s.id = e.session_id LEFT JOIN content_posts post ON e.content_id = post.id LEFT JOIN archive_videos video ON e.content_id = video.id WHERE e.kind NOT IN ('pageview','engagement') AND e.day_kst BETWEEN ? AND ?${where.sql} GROUP BY e.kind, e.content_type, e.content_id ORDER BY total DESC LIMIT 30`, [recentStart, range.end, ...where.args])).map((row) => ({ kind: string(row.kind), contentType: string(row.contentType), contentId: string(row.contentId), title: string(row.title), total: number(row.total) })) : [];
  const actionSources = detailAvailable ? (await rows(`SELECT s.source_category AS source, e.kind AS kind, COUNT(*) AS total FROM analytics_events e JOIN analytics_sessions s ON s.id = e.session_id WHERE e.kind NOT IN ('pageview','engagement') AND e.day_kst BETWEEN ? AND ?${where.sql} GROUP BY s.source_category, e.kind ORDER BY total DESC LIMIT 30`, [recentStart, range.end, ...where.args])).map((row) => ({ source: string(row.source), kind: string(row.kind), total: number(row.total) })) : [];
  const breakdown = async (expression: string, fallback: string, limit?: number) => detailAvailable ? groupSessions(recentStart, range.end, filter, expression, fallback, limit) : [];
  const detailGroups: Array<[string, string, number?]> = [
    ["s.source_category", "direct"], ["s.source_domain", "직접/출처 미확인"],
    ["s.country_code", "ZZ"], ["s.device_type", "unknown"],
    ["s.browser_name", "알 수 없음"], ["s.os_name", "알 수 없음"],
    ["s.utm_campaign", "캠페인 없음"], ["s.entry_path", "기록 없음"],
    ["s.exit_path", "기록 없음"],
    ["(CAST(strftime('%w', s.started_at, '+9 hours') AS INTEGER) + 6) % 7", "0", 7],
    ["strftime('%H', s.started_at, '+9 hours')", "00", 24],
  ];
  const details: Awaited<ReturnType<typeof breakdown>>[] = [];
  for (let index = 0; index < detailGroups.length; index += 3) {
    details.push(...await Promise.all(detailGroups.slice(index, index + 3).map(([expression, fallback, limit]) => breakdown(expression, fallback, limit))));
  }
  const [sources, domains, countries, devices, browsers, systems, campaigns, entries, exits, weekdays, hours] = details;
  const last = (await rows("SELECT MAX(last_seen_at) AS timestamp FROM analytics_sessions"))[0]?.timestamp;
  const lastUpdated = formatUpdatedAt(last);
  return {
    collectionDay, updatedAt: lastUpdated, range, period: options.period, grain: options.grain,
    precollection, coverageStart: range.start < cutoff ? cutoff : range.start, metrics, previous, trend: points,
    pages, pageChanges, actions, actionSources, sources, domains, countries, devices, browsers, systems, campaigns: campaigns.filter((row) => row.label !== "캠페인 없음"), entries, exits, weekdays, hours,
  };
}

export async function getAnalyticsReport(options: AnalyticsReportOptions) {
  const key = `${koreaClock(new Date()).day}:${JSON.stringify(options)}`;
  const cached = reportCache.get(key);
  if (cached && cached.until > Date.now()) return cached.value;
  const value = await buildAnalyticsReport(options);
  if (reportCache.size >= 40) reportCache.clear();
  reportCache.set(key, { until: Date.now() + 60_000, value });
  return value;
}
