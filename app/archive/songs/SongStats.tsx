"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArchiveIcon, ArchiveShell } from "../ArchiveShell";

type Ranking = { rank: number; id: string; displayTitle: string; baseTitle: string; aliases: string[]; totalCount: number; sunday1Count: number; sunday2Count: number; wednesdayCount: number; lastUsed: string };
type StaleSong = { id: string; displayTitle: string; totalCount: number; lastUsed: string; daysSince: number };
type Stats = { summary: { worshipCount: number; songCount: number; usageCount: number; topSong: string }; rankings: Ranking[]; stale: StaleSong[] };
type History = { videoId: string; date: string; serviceType: string; videoTitle: string; order: number };
function archiveSectionForService(serviceType: string) { return serviceType.startsWith("주일 ") ? "sunday" : "other"; }

export default function SongStats({ viewerName, viewerKind }: { viewerName: string; viewerKind: "admin" | "member" }) {
  const yearNow = new Date().getFullYear();
  const [service, setService] = useState("all"); const [period, setPeriod] = useState("all"); const [year, setYear] = useState(String(yearNow));
  const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [limit, setLimit] = useState("50"); const [query, setQuery] = useState(""); const [appliedQuery, setAppliedQuery] = useState("");
  const [stats, setStats] = useState<Stats | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [selected, setSelected] = useState<Ranking | null>(null); const [history, setHistory] = useState<History[]>([]);
  const params = useMemo(() => { const requestPeriod = period === "current" ? "year" : period; const value = new URLSearchParams({ service, period: requestPeriod, limit }); if (requestPeriod === "year") value.set("year", period === "current" ? String(yearNow) : year); if (period === "custom") { if (start) value.set("start", start); if (end) value.set("end", end); } if (appliedQuery) value.set("q", appliedQuery); return value; }, [appliedQuery, end, limit, period, service, start, year, yearNow]);
  const periodLabel = period === "all" ? "전체 기간" : period === "current" ? `${yearNow}년(올해)` : period === "year" ? `${year}년` : period === "last12" ? "최근 12개월" : `${start || "시작일"} ~ ${end || "종료일"}`;
  const [staleOrder, setStaleOrder] = useState("oldest");
  const staleSongs = useMemo(() => stats ? [...stats.stale].sort((a, b) => staleOrder === "oldest" ? b.daysSince - a.daysSince : a.daysSince - b.daysSince) : [], [staleOrder, stats]);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch(`/api/archive/songs/stats?${params}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setStats(data); } catch (caught) { setError(caught instanceof Error ? caught.message : "찬양 통계를 불러오지 못했습니다."); } finally { setLoading(false); } }, [params]);
  useEffect(() => { const timer = setTimeout(() => void load(), 180); return () => clearTimeout(timer); }, [load]);
  async function openHistory(song: Ranking) { setSelected(song); const response = await fetch(`/api/archive/songs/${encodeURIComponent(song.id)}/history?${params}`, { cache: "no-store" }); const data = await response.json(); setHistory(response.ok ? data.history ?? [] : []); }
  return <ArchiveShell active="songs" account={<Link aria-label={`${viewerName} 계정 메뉴`} className="header-action-link user-link" href={viewerKind === "admin" ? "/archive/admin" : "/member"}><ArchiveIcon name="user" size={17} /><span>{viewerName}</span></Link>}>
    <section className="song-stats-page">
      <header className="list-page-head"><span className="song-stats-eyebrow">WORSHIP SONGS</span><h1>찬양 통계</h1><p>예배별 찬양 사용 기록과 다시 부를 찬양을 확인합니다.</p></header>
      <div className="song-stats-filters">
        <label><span>예배 종류</span><select value={service} onChange={(event) => setService(event.target.value)}><option value="all">전체 예배</option><option value="sunday1">주일 1부 예배</option><option value="sunday2">주일 2부 예배</option><option value="wednesday">수요예배</option></select></label>
        <label><span>기간</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">전체 기간</option><option value="current">올해</option><option value="last12">최근 12개월</option><option value="year">연도 선택</option><option value="custom">사용자 지정</option></select></label>
        {period === "year" && <label><span>연도</span><select value={year} onChange={(event) => setYear(event.target.value)}>{Array.from({ length: 10 }, (_, index) => yearNow - index).map((value) => <option key={value}>{value}</option>)}</select></label>}
        {period === "custom" && <><label><span>시작일</span><input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label><span>종료일</span><input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label></>}
        <label><span>표시 개수</span><select value={limit} onChange={(event) => setLimit(event.target.value)}><option value="10">상위 10곡</option><option value="20">상위 20곡</option><option value="50">상위 50곡</option><option value="100">상위 100곡</option><option value="all">전체</option></select></label>
        <label className="song-stats-search"><span>찬양 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setAppliedQuery(query.trim()); } }} placeholder="대표 제목·별칭 검색" /></label>
        <button className="song-search-button" type="button" onClick={() => setAppliedQuery(query.trim())}>검색</button>
        <a className="song-export-button" href={`/api/archive/songs/export?${params}`}>Excel 다운로드</a>
      </div>
      {error && <div className="archive-notice">{error}</div>}
      {stats && <><div className="song-summary-grid"><article><span>대상 예배</span><strong>{stats.summary.worshipCount}</strong></article><article><span>등록 찬양</span><strong>{stats.summary.songCount}</strong></article><article><span>사용 횟수</span><strong>{stats.summary.usageCount}</strong></article><article><span>조회 기간</span><strong className="period-value">{periodLabel}</strong></article><article className="wide"><span>가장 많이 부른 찬양</span><strong>{stats.summary.topSong}</strong></article></div>
        <p className="song-count-note">같은 찬양은 한 예배에서 한 번만 집계하며, 같은 날짜의 1부와 2부 예배는 각각 1회로 계산합니다.</p>
        <section className="song-ranking-card"><h2>찬양 순위</h2><div className="song-table-wrap"><table><thead><tr><th>순위</th><th>찬양 제목</th><th>전체</th><th>주일 1부</th><th>주일 2부</th><th>수요예배</th><th>최근 사용일</th></tr></thead><tbody>{stats.rankings.map((song) => <tr key={song.id}><td>{song.rank}</td><td><button type="button" onClick={() => void openHistory(song)}>{song.displayTitle}</button></td><td>{song.totalCount}</td><td>{song.sunday1Count}</td><td>{song.sunday2Count}</td><td>{song.wednesdayCount}</td><td>{song.lastUsed || "-"}</td></tr>)}</tbody></table>{!loading && !stats.rankings.length && <div className="archive-empty">조건에 맞는 찬양 기록이 없습니다.</div>}</div></section>
        <section className="song-ranking-card stale"><div className="song-ranking-title"><h2>오랫동안 부르지 않은 찬양</h2><select aria-label="오래된 찬양 정렬" value={staleOrder} onChange={(event) => setStaleOrder(event.target.value)}><option value="oldest">오래된 순</option><option value="recent">최근 순</option></select></div><div className="song-table-wrap"><table><thead><tr><th>찬양 제목</th><th>전체 사용</th><th>마지막 사용일</th><th>경과 일수</th></tr></thead><tbody>{staleSongs.map((song) => <tr key={song.id}><td>{song.displayTitle}</td><td>{song.totalCount}</td><td>{song.lastUsed}</td><td>{song.daysSince}일</td></tr>)}</tbody></table></div></section></>}
      {loading && <div className="archive-empty">찬양 통계를 불러오고 있습니다.</div>}
    </section>
    {selected && <div className="song-history-backdrop" role="dialog" aria-modal="true" aria-label={`${selected.displayTitle} 사용 이력`} onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="song-history-modal"><header><div><small>찬양 사용 이력</small><h2>{selected.displayTitle}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="닫기">×</button></header><div className="song-history-list">{history.map((item) => <article key={`${item.videoId}-${item.order}`}><time>{item.date}</time><div><strong>{item.serviceType}</strong><span>{item.videoTitle}</span></div><b>{item.order}번째 찬양</b><Link href={`/archive/${archiveSectionForService(item.serviceType)}?video=${encodeURIComponent(item.videoId)}&q=${encodeURIComponent(item.videoTitle)}`}>영상 보기</Link></article>)}{!history.length && <p>선택한 조건의 사용 이력이 없습니다.</p>}</div></section></div>}
  </ArchiveShell>;
}
