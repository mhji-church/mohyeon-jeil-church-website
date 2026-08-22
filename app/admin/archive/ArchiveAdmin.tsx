"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatArchiveDuration, type ArchiveAccessLevel, type ArchiveVideoAdmin } from "@/lib/archive-shared";
import { ArchiveShell } from "@/app/archive/ArchiveShell";

type Props = { userName: string; userEmail: string; signOutPath: string; mode?: "manage" | "new" };
type AccessMember = { id: string; name: string; username: string; status: string; accessLevel: ArchiveAccessLevel };
type FormState = { id: string; type: "worship" | "attendance"; date: string; serviceType: string; title: string; preacher: string; youtubeUrl: string; thumbnailUrl: string; durationSeconds: string; note: string };
type Notice = { message: string; tone: "success" | "error" } | null;
type VideoTypeFilter = "" | "worship" | "attendance";
type ServiceFilter = "" | "sunday" | "other";
type Settings = { recentCount: 4 | 8 | 12; defaultSort: "newest" | "oldest"; defaultServiceType: string; defaultPreacher: string; autoInspectYoutube: boolean; afterSave: "list" | "continue" };
type SystemStatus = { database: string; youtubeApi: boolean; total: number; worship: number; attendance: number; latest: string };

const emptyForm: FormState = { id: "", type: "worship", date: "", serviceType: "주일 2부 예배", title: "", preacher: "담임목사", youtubeUrl: "", thumbnailUrl: "", durationSeconds: "", note: "" };
const accessLabels: Record<ArchiveAccessLevel, string> = { none: "권한 없음", worship: "예배 영상", full: "전체 기록" };

export default function ArchiveAdmin({ userName, userEmail, signOutPath, mode = "manage" }: Props) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<"videos" | "access" | "settings">(requestedTab === "access" || requestedTab === "settings" ? requestedTab : "videos");
  const [videos, setVideos] = useState<ArchiveVideoAdmin[]>([]);
  const [members, setMembers] = useState<AccessMember[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [notice, setNotice] = useState<Notice>(null);
  const [loadingYoutube, setLoadingYoutube] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<VideoTypeFilter>("");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [settings, setSettings] = useState<Settings>({ recentCount: 4, defaultSort: "newest", defaultServiceType: "주일 2부 예배", defaultPreacher: "담임목사", autoInspectYoutube: true, afterSave: "list" });
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadVideos = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), sort });
    if (search) params.set("search", search);
    if (typeFilter) params.set("type", typeFilter);
    if (serviceFilter) params.set("serviceGroup", serviceFilter);
    const response = await fetch(`/api/admin/archive/videos?${params.toString()}`, { cache: "no-store" });
    const data = await response.json() as { videos?: ArchiveVideoAdmin[]; total?: number; error?: string };
    if (!response.ok) { setNotice({ message: data.error ?? "영상 목록을 불러오지 못했습니다.", tone: "error" }); return; }
    setVideos(data.videos ?? []);
    setTotal(data.total ?? 0);
  }, [page, search, serviceFilter, sort, typeFilter]);

  const loadMembers = useCallback(async () => {
    const response = await fetch("/api/admin/archive/access", { cache: "no-store" });
    const data = await response.json() as { members?: AccessMember[]; error?: string };
    if (!response.ok) { setNotice({ message: data.error ?? "회원 등급을 불러오지 못했습니다.", tone: "error" }); return; }
    setMembers(data.members ?? []);
  }, []);

  useEffect(() => { if (mode === "manage") void loadVideos(); }, [loadVideos, mode]);
  useEffect(() => { if (tab === "access") void loadMembers(); }, [loadMembers, tab]);
  useEffect(() => { if (tab !== "settings" && mode !== "new") return; fetch("/api/archive/settings?admin=1", { cache: "no-store" }).then((response) => response.json()).then((data) => { if (data.settings) { setSettings(data.settings); setForm((current) => current.id || current.youtubeUrl || current.title ? current : { ...current, serviceType: data.settings.defaultServiceType, preacher: data.settings.defaultPreacher }); } if (data.status) setSystemStatus(data.status); }).catch(() => setNotice({ message: "운영 설정을 불러오지 못했습니다.", tone: "error" })); }, [mode, tab]);
  useEffect(() => { setTab(requestedTab === "access" || requestedTab === "settings" ? requestedTab : "videos"); }, [requestedTab]);
  useEffect(() => {
    if (mode === "new" || !form.id) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setForm(emptyForm); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [form.id, mode]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }

  async function inspectYouTube() {
    if (!form.youtubeUrl.trim() || loadingYoutube) return;
    setLoadingYoutube(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/archive/youtube?url=${encodeURIComponent(form.youtubeUrl)}`, { cache: "no-store" });
      const data = await response.json() as Partial<FormState> & { durationSeconds?: number | null; error?: string };
      if (!response.ok) throw new Error(data.error);
      setForm((current) => ({ ...current, type: data.type === "attendance" ? "attendance" : "worship", date: data.date || current.date, serviceType: data.serviceType || current.serviceType, title: data.title || current.title, thumbnailUrl: data.thumbnailUrl || current.thumbnailUrl, durationSeconds: data.durationSeconds == null ? "" : String(data.durationSeconds) }));
      setNotice({ message: "유튜브 정보가 자동 입력되었습니다. 내용을 확인한 뒤 저장해 주세요.", tone: "success" });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "유튜브 정보를 확인하지 못했습니다.", tone: "error" });
    } finally {
      setLoadingYoutube(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice(null);
    const editing = Boolean(form.id);
    try {
      const response = await fetch("/api/admin/archive/videos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, durationSeconds: form.durationSeconds || null }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "영상을 저장하지 못했습니다.");
      setNotice({ message: editing ? "수정이 완료되었습니다." : "등록이 완료되었습니다.", tone: "success" });
      setForm({ ...emptyForm, serviceType: settings.defaultServiceType, preacher: settings.defaultPreacher });
      if (!editing && mode === "new" && settings.afterSave === "list") location.assign("/archive/admin");
      if (mode === "manage") await loadVideos();
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "영상을 저장하지 못했습니다.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  function edit(video: ArchiveVideoAdmin) {
    setForm({ id: video.id, type: video.type, date: video.date, serviceType: video.serviceType, title: video.title, preacher: video.preacher, youtubeUrl: video.youtubeUrl, thumbnailUrl: video.thumbnailUrl, durationSeconds: video.durationSeconds == null ? "" : String(video.durationSeconds), note: video.note });
  }

  async function remove(video: ArchiveVideoAdmin) {
    if (!window.confirm(`'${video.title}' 영상을 삭제할까요?`)) return;
    const response = await fetch(`/api/admin/archive/videos/${encodeURIComponent(video.id)}`, { method: "DELETE" });
    if (response.ok) { setNotice({ message: "영상이 삭제되었습니다.", tone: "success" }); await loadVideos(); }
    else setNotice({ message: "영상을 삭제하지 못했습니다.", tone: "error" });
  }

  async function changeAccess(member: AccessMember, accessLevel: ArchiveAccessLevel) {
    if (updatingMemberId || accessLevel === member.accessLevel) return;
    setUpdatingMemberId(member.id);
    try {
      const response = await fetch("/api/admin/archive/access", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: member.id, accessLevel }) });
      if (!response.ok) throw new Error("아카이브 등급을 변경하지 못했습니다.");
      setMembers((current) => current.map((item) => item.id === member.id ? { ...item, accessLevel } : item));
      setNotice({ message: `${member.name}님의 아카이브 등급을 변경했습니다.`, tone: "success" });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "아카이브 등급을 변경하지 못했습니다.", tone: "error" });
    } finally {
      setUpdatingMemberId("");
    }
  }

  function applySearch(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  function resetFilters() {
    setSearchDraft("");
    setSearch("");
    setTypeFilter("");
    setServiceFilter("");
    setSort("newest");
    setPage(1);
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault(); if (savingSettings) return; setSavingSettings(true);
    try { const response = await fetch("/api/archive/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSettings(data.settings); setNotice({ message: "아카이브 운영 설정을 저장했습니다.", tone: "success" }); }
    catch (error) { setNotice({ message: error instanceof Error ? error.message : "설정을 저장하지 못했습니다.", tone: "error" }); }
    finally { setSavingSettings(false); }
  }

  const serviceOptions = form.type === "attendance" ? ["주일예배", "수요예배", "특별예배"] : ["주일 1부 예배", "주일 2부 예배", "수요예배", "특별예배"];
  const totalPages = Math.max(1, Math.ceil(total / 10));
  const hasFilters = Boolean(search || typeFilter || serviceFilter || sort !== "newest");

  const videoForm = (variant: "page" | "drawer") => (
    <form className={`archive-admin-form archive-editor-form admin-card admin-form is-${variant}`} onSubmit={save}>
      <div className="archive-form-heading">
        <div><h2>{form.id ? "영상 수정" : "새 영상 등록"}</h2><p>유튜브 주소를 불러온 뒤 필요한 정보만 확인해 주세요.</p></div>
        {variant === "drawer" && <button className="archive-drawer-close" type="button" onClick={() => setForm(emptyForm)} aria-label="영상 수정 닫기">×</button>}
      </div>
      <label className="archive-youtube-field youtube-url-field"><span>유튜브 URL</span><div><input value={form.youtubeUrl} onChange={(event) => update("youtubeUrl", event.target.value)} onBlur={() => { if (settings.autoInspectYoutube) void inspectYouTube(); }} placeholder="https://www.youtube.com/watch?v=..." required /><button className="secondary-btn" type="button" onClick={() => void inspectYouTube()} disabled={loadingYoutube}>{loadingYoutube ? "확인 중" : "정보 불러오기"}</button></div><small>구분, 날짜, 예배 종류, 제목, 길이와 썸네일을 자동으로 확인합니다.</small></label>
      <div className="archive-editor-grid"><label><span>구분</span><select value={form.type} onChange={(event) => { const type = event.target.value as FormState["type"]; setForm((current) => ({ ...current, type, serviceType: type === "attendance" ? "주일예배" : "주일 2부 예배" })); }}><option value="worship">예배 전체 실황</option><option value="attendance">교인 출석 현황</option></select></label><label><span>날짜</span><input type="date" value={form.date} onChange={(event) => update("date", event.target.value)} required /></label><label><span>예배 종류</span><select value={form.serviceType} onChange={(event) => update("serviceType", event.target.value)}>{serviceOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label><span>설교자</span><select value={form.preacher} onChange={(event) => update("preacher", event.target.value)}><option>담임목사</option><option>초청강사</option></select></label></div>
      <label><span>영상 제목</span><input value={form.title} onChange={(event) => update("title", event.target.value)} required /></label>
      <details key={form.id || "new"} className="archive-advanced-fields" open={Boolean(form.id)}><summary>고급 설정 <small>자동 입력값과 비고</small></summary><div className="archive-advanced-grid"><label><span>영상 길이(초)</span><input type="number" min="0" value={form.durationSeconds} onChange={(event) => update("durationSeconds", event.target.value)} placeholder="자동 입력" /></label><label><span>썸네일 URL</span><input value={form.thumbnailUrl} onChange={(event) => update("thumbnailUrl", event.target.value)} placeholder="자동 입력" /></label><label className="archive-note-field"><span>비고</span><textarea value={form.note} onChange={(event) => update("note", event.target.value)} rows={2} /></label></div></details>
      <div className="archive-admin-form-actions button-row">{form.id && <button className="secondary-btn" type="button" onClick={() => setForm(emptyForm)}>수정 취소</button>}<button className="primary-btn" type="submit" disabled={saving}>{saving ? "저장 중" : form.id ? "수정 저장" : "영상 등록"}</button></div>
    </form>
  );

  return (
    <ArchiveShell admin active={tab === "access" ? "members" : tab === "settings" ? "settings" : "videos"} account={<a className="header-action-link" href={signOutPath}>로그아웃</a>}>
      <section className={`archive-admin-workspace${mode === "new" ? " is-new-video" : " is-list-mode"}`}>
        <header className="cms-page-head has-actions"><div className="cms-page-title"><h1>{mode === "new" ? "새 영상 등록" : tab === "access" ? "회원 관리" : tab === "settings" ? "설정" : "영상 관리"}</h1><p>{userName} · {userEmail}</p></div><div className="cms-page-actions"><a className="secondary-btn" href="/archive" target="_blank">아카이브 보기</a>{mode === "new" ? <Link className="secondary-btn" href="/archive/admin">목록으로</Link> : tab === "videos" && <Link className="primary-btn" href="/archive/admin/new">+ 새 영상 등록</Link>}</div></header>
        {mode === "manage" && <div className="archive-admin-tabs segmented-control"><button className={tab === "videos" ? "active" : ""} type="button" onClick={() => { setTab("videos"); setForm(emptyForm); }}>영상 관리</button><button className={tab === "access" ? "active" : ""} type="button" onClick={() => { setTab("access"); setForm(emptyForm); }}>열람 등급</button></div>}
        {notice && <div className={`toast-message is-${notice.tone}`} role="status" aria-live="polite"><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="알림 닫기">×</button></div>}
        {mode === "new" ? <div className="archive-form-page">{videoForm("page")}</div> : tab === "videos" ? <>
          <section className="admin-card archive-video-list">
            <div className="archive-list-head"><div className="admin-list-heading"><h2>등록된 영상</h2><span>총 {total}개</span></div><form className="archive-list-search" onSubmit={applySearch}><label><span className="sr-only">영상 검색</span><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="제목·날짜·설교자 검색" /></label><button className="secondary-btn" type="submit">검색</button></form></div>
            <div className="archive-list-filters"><label><span>구분</span><select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value as VideoTypeFilter); setPage(1); }}><option value="">전체 구분</option><option value="worship">예배 실황</option><option value="attendance">출석 기록</option></select></label><label><span>예배 분류</span><select value={serviceFilter} onChange={(event) => { setServiceFilter(event.target.value as ServiceFilter); setPage(1); }}><option value="">전체 예배</option><option value="sunday">주일예배</option><option value="other">기타예배</option></select></label><label><span>정렬</span><select value={sort} onChange={(event) => { setSort(event.target.value as "newest" | "oldest"); setPage(1); }}><option value="newest">최신순</option><option value="oldest">오래된순</option></select></label>{hasFilters && <button className="archive-filter-reset" type="button" onClick={resetFilters}>초기화</button>}</div>
            <div className="table-wrap"><table className="admin-table"><thead><tr><th>날짜</th><th>구분</th><th>제목</th><th>예배 종류</th><th>길이</th><th>관리</th></tr></thead><tbody>{videos.map((video) => <tr key={video.id}><td>{video.date}</td><td>{video.type === "attendance" ? "출석 기록" : "예배 실황"}</td><td><strong>{video.title}</strong></td><td>{video.serviceType}</td><td>{formatArchiveDuration(video.durationSeconds)}</td><td><div className="admin-row-actions"><button className="small-btn" type="button" onClick={() => edit(video)}>수정</button><button className="danger-btn" type="button" onClick={() => void remove(video)}>삭제</button></div></td></tr>)}</tbody></table>{videos.length === 0 && <div className="archive-list-empty">조건에 맞는 영상이 없습니다.</div>}</div>
            <footer className="archive-admin-pagination pager"><span>{total ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, total)} / 총 ${total}개` : "총 0개"}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>이전</button><b>{page} / {totalPages}페이지</b><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>다음</button></div></footer>
          </section>
          {form.id && <div className="archive-edit-layer"><button className="archive-edit-backdrop" type="button" aria-label="영상 수정 닫기" onClick={() => setForm(emptyForm)} /><aside className="archive-edit-drawer" role="dialog" aria-modal="true" aria-label="영상 수정">{videoForm("drawer")}</aside></div>}
        </> : tab === "access" ? <section className="admin-card archive-access-list"><div className="admin-list-heading"><h2>회원별 열람 등급</h2><span>총 {members.length}명</span></div><div className="table-wrap"><table className="admin-table"><thead><tr><th>회원</th><th>계정 상태</th><th>아카이브 등급</th><th>열람 범위</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><strong>{member.name}</strong><small>{member.username}</small></td><td>{member.status}</td><td><select value={member.accessLevel} disabled={updatingMemberId === member.id} onChange={(event) => void changeAccess(member, event.target.value as ArchiveAccessLevel)}><option value="none">권한 없음</option><option value="worship">예배 영상</option><option value="full">전체 기록</option></select></td><td>{updatingMemberId === member.id ? "저장 중…" : accessLabels[member.accessLevel]}</td></tr>)}</tbody></table></div></section> : <div className="archive-settings-grid"><form className="admin-card archive-settings-panel" onSubmit={saveSettings}><div className="admin-list-heading"><h2>운영 설정</h2><span>공개 화면·등록 기본값</span></div><div className="archive-settings-fields"><label><span>홈 최근 영상 수</span><select value={settings.recentCount} onChange={(event) => setSettings((current) => ({ ...current, recentCount: Number(event.target.value) as 4 | 8 | 12 }))}><option value="4">4개</option><option value="8">8개</option><option value="12">12개</option></select></label><label><span>기본 정렬</span><select value={settings.defaultSort} onChange={(event) => setSettings((current) => ({ ...current, defaultSort: event.target.value as Settings["defaultSort"] }))}><option value="newest">최신순</option><option value="oldest">오래된순</option></select></label><label><span>신규 영상 기본 예배</span><select value={settings.defaultServiceType} onChange={(event) => setSettings((current) => ({ ...current, defaultServiceType: event.target.value }))}><option>주일 1부 예배</option><option>주일 2부 예배</option><option>수요예배</option><option>특별예배</option></select></label><label><span>기본 설교자</span><input value={settings.defaultPreacher} onChange={(event) => setSettings((current) => ({ ...current, defaultPreacher: event.target.value }))} /></label><label className="archive-setting-check"><input type="checkbox" checked={settings.autoInspectYoutube} onChange={(event) => setSettings((current) => ({ ...current, autoInspectYoutube: event.target.checked }))} /><span>URL 입력 후 자동으로 영상 정보 확인</span></label><label><span>등록 완료 후</span><select value={settings.afterSave} onChange={(event) => setSettings((current) => ({ ...current, afterSave: event.target.value as Settings["afterSave"] }))}><option value="list">목록으로 이동</option><option value="continue">계속 등록</option></select></label></div><div className="archive-settings-actions"><button className="primary-btn" disabled={savingSettings}>{savingSettings ? "저장 중…" : "설정 저장"}</button></div></form><section className="admin-card archive-system-status"><div className="admin-list-heading"><h2>시스템 상태</h2><span>비밀값은 표시하지 않습니다</span></div><div className="archive-status-cards"><article><small>데이터베이스</small><strong>{systemStatus?.database === "connected" ? "정상 연결" : "확인 중"}</strong></article><article><small>YouTube API</small><strong>{systemStatus ? systemStatus.youtubeApi ? "설정됨" : "미설정" : "확인 중"}</strong></article><article><small>전체 기록</small><strong>{systemStatus?.total ?? "-"}개</strong></article><article><small>예배 / 출석</small><strong>{systemStatus ? `${systemStatus.worship} / ${systemStatus.attendance}` : "-"}</strong></article></div><div className="archive-security-summary"><h3>권한 정책</h3><p>회원 데이터는 홈페이지와 공유하지만 관리자 세션은 분리됩니다. 홈페이지 관리자 쿠키로는 이 화면과 아카이브 관리 API에 접근할 수 없습니다.</p><p>마지막 영상 갱신: {systemStatus?.latest ? new Date(systemStatus.latest).toLocaleString("ko-KR") : "기록 없음"}</p></div></section></div>}
      </section>
    </ArchiveShell>
  );
}
