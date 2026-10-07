"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { actionLabels, type AnalyticsAction, type AnalyticsPeriod } from "@/lib/analytics-model";
import type { AnalyticsReport } from "@/lib/analytics-report";

const periodLabels: Record<AnalyticsPeriod, string> = { today: "오늘", yesterday: "어제", week: "이번 주", month: "이번 달", year: "올해", all: "전체 기간", custom: "직접 선택" };
const sourceLabels: Record<string, string> = { search: "검색", sns: "SNS", external: "외부 사이트", direct: "직접/출처 미확인", other: "기타" };
const deviceLabels: Record<string, string> = { mobile: "모바일", desktop: "PC", tablet: "태블릿", unknown: "알 수 없음" };
const pageLabels: Record<string, string> = { "/": "홈", "/about": "교회 소개", "/worship": "예배 안내", "/sermons": "설교 모음", "/bulletin": "주보", "/news": "교회소식", "/business": "성도사업장", "/gallery": "갤러리", "/archive": "예배 아카이브", "/archive/sunday": "주일예배", "/archive/other": "기타예배", "/archive/attendance": "출석 기록", "/archive/songs": "찬양 통계" };
const countryNames = new Intl.DisplayNames(["ko"], { type: "region" });
type Breakdown = { label: string; visitors: number; visits: number };
type Metric = "visitors" | "visits" | "pageviews";
const metricLabels: Record<Metric, string> = { visitors: "방문자 수", visits: "방문 횟수", pageviews: "페이지 조회수" };
const integer = (value: number) => new Intl.NumberFormat("ko-KR").format(value);
const pageName = (path: string) => pageLabels[path] ?? path;
function labelCountry(value: string) { try { return value === "ZZ" ? "알 수 없음" : countryNames.of(value) ?? value; } catch { return value; } }
function change(current: number, previous: number | undefined) {
  if (previous === undefined) return "비교 자료 없음";
  if (!previous) return current ? "새 기록" : "변화 없음";
  const amount = Math.round((current - previous) / previous * 100);
  return `${amount > 0 ? "+" : ""}${amount}%`;
}

function DetailTable({ title, rows, format = (value: string) => value }: { title: string; rows: Breakdown[]; format?: (value: string) => string }) {
  return <details className="analytics-panel analytics-detail"><summary>{title}<span>{rows.length ? `${rows.length}개 항목` : "자료 없음"}</span></summary>
    {rows.length ? <div className="analytics-table-scroll"><table><thead><tr><th scope="col">항목</th><th scope="col">방문자 수</th><th scope="col">방문 횟수</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{format(row.label)}{format(row.label) !== row.label && <small className="analytics-path">{row.label}</small>}</th><td>{integer(row.visitors)}</td><td>{integer(row.visits)}</td></tr>)}</tbody></table></div> : <p className="analytics-empty">선택 기간에 기록이 없습니다.</p>}
  </details>;
}

function BreakdownPanel({ id, title, rows, format, basis, total }: { id: string; title: string; rows: Breakdown[]; format: (value: string) => string; basis: "visitors" | "visits"; total: number }) {
  return <section className="analytics-panel" aria-labelledby={id}><div className="analytics-panel-title"><h2 id={id}>{title}</h2><small>비율 기준: {basis === "visitors" ? "방문자 수" : "방문 횟수"}</small></div>
    {rows.length ? <ol className="analytics-ranked">{rows.map((row) => <li key={row.label}><span>{format(row.label)}</span><strong>{integer(row[basis])}{basis === "visitors" ? "명" : "회"}</strong><small>{total ? Math.round(row[basis] / total * 100) : 0}%</small></li>)}</ol> : <p className="analytics-empty">기록이 없습니다.</p>}
  </section>;
}

export default function AnalyticsDashboard({ initialPeriod = "month" }: { initialPeriod?: AnalyticsPeriod }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>(initialPeriod);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [grain, setGrain] = useState<"day" | "week" | "month" | "year">("day");
  const [source, setSource] = useState("");
  const [device, setDevice] = useState("");
  const [country, setCountry] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<Metric>("visitors");
  const [focusedPoint, setFocusedPoint] = useState<string | null>(null);
  const [result, setResult] = useState<{ key: string; report: AnalyticsReport | null; error: string }>({ key: "", report: null, error: "" });
  const [version, setVersion] = useState(0);
  const activeFilters = Number(Boolean(source)) + Number(Boolean(device)) + Number(Boolean(country));
  const clearFilters = () => { setSource(""); setDevice(""); setCountry(""); };
  const query = useMemo(() => {
    const params = new URLSearchParams({ period, grain });
    if (period === "custom") { if (start) params.set("start", start); if (end) params.set("end", end); }
    if (source) params.set("source", source);
    if (device) params.set("device", device);
    if (country) params.set("country", country);
    return params.toString();
  }, [period, grain, start, end, source, device, country]);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const key = `${query}&reload=${version}`;
  const customError = period === "custom" && (!start || !end) ? "시작일과 종료일을 선택해 주세요." : "";
  const loading = !customError && result.key !== key;
  const error = customError || (result.key === key ? result.error : "");
  const report = result.key === key ? result.report : null;
  useEffect(() => {
    if (customError) return;
    const controller = new AbortController();
    fetch(`/api/admin/analytics?${query}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "접속 통계를 불러오지 못했습니다."); return data as AnalyticsReport; })
      .then((data) => { if (!controller.signal.aborted) setResult({ key, report: data, error: "" }); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setResult({ key, report: null, error: cause instanceof Error ? cause.message : "접속 통계를 불러오지 못했습니다." }); });
    return () => controller.abort();
  }, [customError, query, key]);

  const metrics = report?.metrics;
  const points = report?.trend ?? [];
  const chartMax = Math.max(1, ...points.filter((point) => !point.precollection).map((point) => point[chartMetric]));
  const chartStep = chartMax <= 4 ? 1 : Math.ceil(chartMax / 4);
  const chartTop = chartStep * 4;
  const firstDay = report && report.collectionDay >= report.range.start && report.collectionDay === report.range.end;
  return <section className="admin-workspace admin-members-workspace analytics-workspace" aria-labelledby="analytics-title">
    <header className="analytics-header"><div><span className="analytics-eyebrow">SITE ANALYTICS</span><h1 id="analytics-title">접속 통계</h1><p>익명으로 집계한 홈페이지 이용 현황을 확인합니다.</p></div><button type="button" onClick={reload} aria-label="통계 새로고침">새로고침</button></header>
    <section className="analytics-panel analytics-filters" aria-label="통계 기간과 필터">
      <div className="analytics-periods" role="group" aria-label="기간 선택">{(Object.keys(periodLabels) as AnalyticsPeriod[]).map((value) => <button key={value} type="button" className={period === value ? "is-selected" : ""} aria-pressed={period === value} onClick={() => setPeriod(value)}>{periodLabels[value]}</button>)}</div>
      {period === "custom" && <div className="analytics-filter-row"><label>시작일<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>종료일<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div>}
      <div className="analytics-filter-toggle"><button type="button" aria-expanded={filtersOpen} aria-controls="analytics-additional-filters" onClick={() => setFiltersOpen((value) => !value)}>필터{activeFilters ? ` ${activeFilters}개 적용` : ""} <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span></button>{activeFilters > 0 && <button type="button" onClick={clearFilters}>필터 초기화</button>}</div>
      <div id="analytics-additional-filters" className={`analytics-filter-row analytics-additional-filters${filtersOpen ? " is-open" : ""}`}><label>추이<select value={grain} onChange={(event) => setGrain(event.target.value as typeof grain)}><option value="day">일간</option><option value="week">주간</option><option value="month">월간</option><option value="year">연간</option></select></label><label>유입<select value={source} onChange={(event) => setSource(event.target.value)}><option value="">전체 유입</option>{Object.entries(sourceLabels).map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label><label>기기<select value={device} onChange={(event) => setDevice(event.target.value)}><option value="">전체 기기</option>{Object.entries(deviceLabels).filter(([value]) => value !== "unknown").map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label><label>국가<select value={country} onChange={(event) => setCountry(event.target.value)}><option value="">전체 국가</option>{report?.countries.map((row) => <option value={row.label} key={row.label}>{labelCountry(row.label)}</option>)}</select></label></div>
    </section>
    {loading && <p role="status" className="analytics-notice">접속 통계를 불러오는 중입니다…</p>}
    {error && <div role="alert" className="analytics-notice analytics-error">{error} <button type="button" onClick={reload}>다시 시도</button></div>}
    {!loading && !error && report && <>
      <p className="analytics-meta">{report.range.start} ~ {report.range.end} · 수집 시작 {report.collectionDay} · 마지막 갱신 {report.updatedAt ?? "기록 없음"}</p>
      {report.precollection ? <div className="analytics-notice">수집 전 기간입니다. 과거 통계는 생성하지 않았습니다.</div> : <>
        <div className="analytics-kpis analytics-primary-kpis">{(["visitors", "visits", "pageviews"] as Metric[]).map((metric) => <div className="analytics-panel analytics-kpi" key={metric}><span>{metricLabels[metric]}</span><strong>{integer(metrics?.[metric] ?? 0)}{metric === "visitors" && metrics?.visitorsEstimated && <small> 추정</small>}</strong><small>{period === "today" ? "오늘 진행 중 · 비교 생략" : `이전 기간 대비 ${change(metrics?.[metric] ?? 0, report.previous?.[metric])}`}</small></div>)}</div>
        <div className="analytics-panel analytics-secondary-kpis" aria-label="보조 지표">{[["신규 방문자", `${integer(metrics?.newVisitors ?? 0)}명`], ["재방문자", `${integer(metrics?.returningVisitors ?? 0)}명`], ["방문당 조회수", String(metrics?.pagesPerVisit ?? 0)], ["평균 참여 시간", `${metrics?.averageEngagementSeconds ?? 0}초`]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        {!metrics?.visits && <div className="analytics-notice">수집 이후 선택 기간에 기록된 방문이 없습니다.</div>}
        {metrics?.historicBreakdownUnavailable && <div className="analytics-notice">상세 자료는 최근 400일만 보관합니다. 이전 날짜의 방문자·추이 방문자 수는 추정이며, 오래된 기간의 세부 분류와 정확한 기간별 중복 제거는 제공되지 않습니다.</div>}
        <section className="analytics-panel analytics-trend-panel" aria-labelledby="analytics-trend"><div className="analytics-panel-title"><h2 id="analytics-trend">방문 추이</h2><label>표시 지표<select value={chartMetric} onChange={(event) => setChartMetric(event.target.value as Metric)}>{(Object.keys(metricLabels) as Metric[]).map((metric) => <option key={metric} value={metric}>{metricLabels[metric]}</option>)}</select></label></div>
          {firstDay ? <p className="analytics-empty">통계 수집을 시작했습니다. 데이터가 쌓이면 추이를 확인할 수 있습니다.</p> : <div className="analytics-chart-wrap"><div className="analytics-chart-y" aria-hidden="true">{[4, 3, 2, 1, 0].map((tick) => <span key={tick}>{integer(chartStep * tick)}</span>)}</div><div className="analytics-chart" aria-label={`${metricLabels[chartMetric]} ${grain === "day" ? "일간" : grain === "week" ? "주간" : grain === "month" ? "월간" : "연간"} 추이`}>{points.map((point) => <div className="analytics-chart-point" key={point.bucket}><button type="button" onFocus={() => setFocusedPoint(point.bucket)} onBlur={() => setFocusedPoint(null)} onMouseEnter={() => setFocusedPoint(point.bucket)} onMouseLeave={() => setFocusedPoint(null)} aria-label={`${point.bucket}: ${point.precollection ? "수집 전" : `${metricLabels[chartMetric]} ${integer(point[chartMetric])}${chartMetric === "visitors" ? "명" : "회"}${point.estimated ? " 추정" : ""}`}`} title={`${point.bucket}: ${point.precollection ? "수집 전" : `방문자 ${point.visitors}명, 방문 ${point.visits}회, 조회 ${point.pageviews}회${point.estimated ? " (추정)" : ""}`}`}><span className={point.precollection ? "is-precollection" : ""} style={{ height: `${point.precollection ? 4 : Math.max(4, point[chartMetric] / chartTop * 100)}%` }} /></button><small>{point.bucket.slice(-5)}</small>{focusedPoint === point.bucket && <output className="analytics-chart-tooltip">{point.bucket}<br />{point.precollection ? "수집 전" : `${metricLabels[chartMetric]} ${integer(point[chartMetric])}${chartMetric === "visitors" ? "명" : "회"}`}</output>}</div>)}</div></div>}
        </section>
        <div className="analytics-two-column">
          <section className="analytics-panel" aria-labelledby="analytics-pages"><div className="analytics-panel-title"><h2 id="analytics-pages">인기 페이지</h2><small>조회수 · 방문자 수</small></div>
            {report.pages.length ? <ol className="analytics-ranked">{report.pages.map((row) => {
              const compared = report.pageChanges.find((item) => item.label === row.label && item.contentId === row.contentId);
              const title = row.title || pageName(row.label);
              return <li key={`${row.label}:${row.contentId}`}><span><b title={title}>{title}</b>{title !== row.label && <small className="analytics-path">{row.label}</small>}</span><strong>{integer(row.pageviews)}회</strong><small>방문자 {integer(row.visitors)}명{compared ? ` · 이전 대비 ${compared.difference > 0 ? "+" : ""}${compared.difference}회` : ""}</small></li>;
            })}</ol> : <p className="analytics-empty">기록된 페이지가 없습니다.</p>}
          </section>
          <section className="analytics-panel" aria-labelledby="analytics-actions"><div className="analytics-panel-title"><h2 id="analytics-actions">주요 행동</h2><small>영상 열기는 시청 완료가 아닙니다</small></div>{report.actions.length ? <ol className="analytics-ranked">{report.actions.map((row) => <li key={`${row.kind}-${row.contentId}`}><span>{actionLabels[row.kind as AnalyticsAction] ?? row.kind}{row.title ? ` · ${row.title}` : ""}</span><strong>{integer(row.total)}회</strong></li>)}</ol> : <p className="analytics-empty">기록된 행동이 없습니다.</p>}</section>
        </div>
        <div className="analytics-two-column"><BreakdownPanel id="analytics-source" title="유입 출처" rows={report.sources} format={(value) => sourceLabels[value] ?? value} basis="visits" total={metrics?.visits ?? 0} /><BreakdownPanel id="analytics-country" title="국가" rows={report.countries} format={labelCountry} basis="visitors" total={metrics?.visitors ?? 0} /></div>
        <div className="analytics-two-column"><BreakdownPanel id="analytics-device" title="기기" rows={report.devices} format={(value) => deviceLabels[value] ?? value} basis="visitors" total={metrics?.visitors ?? 0} /></div>
        <section className="analytics-details" aria-label="상세 분석"><h2>상세 분석</h2><div className="analytics-details-grid"><DetailTable title="외부 유입 도메인" rows={report.domains} /><DetailTable title="브라우저" rows={report.browsers} /><DetailTable title="운영체제" rows={report.systems} /><DetailTable title="UTM 캠페인" rows={report.campaigns} /><DetailTable title="방문 시작 페이지" rows={report.entries} format={pageName} /><DetailTable title="종료 페이지" rows={report.exits} format={pageName} /><DetailTable title="요일별" rows={report.weekdays} format={(value) => ["월", "화", "수", "목", "금", "토", "일"][Number(value)] ?? value} /><DetailTable title="시간대별" rows={report.hours} format={(value) => `${value}시`} />{report.actionSources.length > 0 && <details className="analytics-panel analytics-detail"><summary>유입별 주요 행동</summary><div className="analytics-table-scroll"><table><thead><tr><th>유입</th><th>행동</th><th>횟수</th></tr></thead><tbody>{report.actionSources.map((row) => <tr key={`${row.source}-${row.kind}`}><td>{sourceLabels[row.source] ?? row.source}</td><td>{actionLabels[row.kind as AnalyticsAction] ?? row.kind}</td><td>{integer(row.total)}</td></tr>)}</tbody></table></div></details>}</div></section>
        <div className="analytics-panel analytics-export"><a className="analytics-csv-link" href={`/api/admin/analytics/export?${query}`} download>선택 기간·필터 CSV 다운로드</a><details><summary>집계 기준과 한계</summary><p>한국 시간 기준이며 한 주는 월요일부터 일요일까지입니다. 임의의 익명 식별 쿠키별로 30분 동안 활동이 없으면 새 방문으로 집계합니다. 방문자 수는 선택 기간의 중복을 제거합니다. 쿠키 삭제, 다른 브라우저나 기기 사용은 별도 방문자로 계산될 수 있습니다. 알려진 자동화 트래픽은 가능한 범위에서 제외합니다. 평균 참여 시간은 활성 탭에서 측정 가능한 시간에 한합니다. 유입 정보가 없는 경우 직접/출처 미확인입니다. 국가는 신뢰 가능한 서버 측 위치 정보가 없으면 알 수 없음으로 표시합니다.</p></details></div>
      </>}
    </>}
  </section>;
}
