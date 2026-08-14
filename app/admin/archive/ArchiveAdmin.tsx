"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatArchiveDuration, type ArchiveAccessLevel, type ArchiveVideoAdmin } from "@/lib/archive-shared";

type Props = { userName: string; userEmail: string; signOutPath: string };
type AccessMember = { id: string; name: string; username: string; status: string; accessLevel: ArchiveAccessLevel };
type FormState = { id: string; type: "worship" | "attendance"; date: string; serviceType: string; title: string; preacher: string; youtubeUrl: string; thumbnailUrl: string; durationSeconds: string; note: string };

const emptyForm: FormState = { id: "", type: "worship", date: "", serviceType: "주일 2부 예배", title: "", preacher: "담임목사", youtubeUrl: "", thumbnailUrl: "", durationSeconds: "", note: "" };
const accessLabels: Record<ArchiveAccessLevel, string> = { none: "권한 없음", worship: "예배 영상", full: "전체 기록" };

export default function ArchiveAdmin({ userName, userEmail, signOutPath }: Props) {
  const [tab, setTab] = useState<"videos" | "access">("videos");
  const [videos, setVideos] = useState<ArchiveVideoAdmin[]>([]);
  const [members, setMembers] = useState<AccessMember[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [notice, setNotice] = useState("");
  const [loadingYoutube, setLoadingYoutube] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadVideos = useCallback(async () => {
    const response = await fetch(`/api/admin/archive/videos?page=${page}`, { cache: "no-store" });
    const data = await response.json() as { videos?: ArchiveVideoAdmin[]; total?: number; error?: string };
    if (!response.ok) { setNotice(data.error ?? "영상 목록을 불러오지 못했습니다."); return; }
    setVideos(data.videos ?? []); setTotal(data.total ?? 0);
  }, [page]);

  const loadMembers = useCallback(async () => {
    const response = await fetch("/api/admin/archive/access", { cache: "no-store" });
    const data = await response.json() as { members?: AccessMember[]; error?: string };
    if (!response.ok) { setNotice(data.error ?? "회원 등급을 불러오지 못했습니다."); return; }
    setMembers(data.members ?? []);
  }, []);

  useEffect(() => { void loadVideos(); }, [loadVideos]);
  useEffect(() => { if (tab === "access") void loadMembers(); }, [loadMembers, tab]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }

  async function inspectYouTube() {
    if (!form.youtubeUrl.trim()) return;
    setLoadingYoutube(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/archive/youtube?url=${encodeURIComponent(form.youtubeUrl)}`, { cache: "no-store" });
      const data = await response.json() as Partial<FormState> & { durationSeconds?: number | null; error?: string };
      if (!response.ok) throw new Error(data.error);
      setForm((current) => ({ ...current, type: data.type === "attendance" ? "attendance" : "worship", date: data.date || current.date, serviceType: data.serviceType || current.serviceType, title: data.title || current.title, thumbnailUrl: data.thumbnailUrl || current.thumbnailUrl, durationSeconds: data.durationSeconds == null ? "" : String(data.durationSeconds) }));
      setNotice("유튜브 정보가 자동 입력되었습니다. 내용을 확인한 뒤 저장해 주세요.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "유튜브 정보를 확인하지 못했습니다."); }
    finally { setLoadingYoutube(false); }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setNotice("");
    const response = await fetch("/api/admin/archive/videos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, durationSeconds: form.durationSeconds || null }) });
    const data = await response.json() as { error?: string };
    if (response.ok) { setNotice(form.id ? "수정이 완료되었습니다." : "등록이 완료되었습니다."); setForm(emptyForm); await loadVideos(); }
    else setNotice(data.error ?? "영상을 저장하지 못했습니다.");
    setSaving(false);
  }

  function edit(video: ArchiveVideoAdmin) {
    setForm({ id: video.id, type: video.type, date: video.date, serviceType: video.serviceType, title: video.title, preacher: video.preacher, youtubeUrl: video.youtubeUrl, thumbnailUrl: video.thumbnailUrl, durationSeconds: video.durationSeconds == null ? "" : String(video.durationSeconds), note: video.note });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(video: ArchiveVideoAdmin) {
    if (!window.confirm(`'${video.title}' 영상을 삭제할까요?`)) return;
    const response = await fetch(`/api/admin/archive/videos/${encodeURIComponent(video.id)}`, { method: "DELETE" });
    if (response.ok) { setNotice("영상이 삭제되었습니다."); await loadVideos(); }
    else setNotice("영상을 삭제하지 못했습니다.");
  }

  async function changeAccess(member: AccessMember, accessLevel: ArchiveAccessLevel) {
    const response = await fetch("/api/admin/archive/access", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: member.id, accessLevel }) });
    if (response.ok) { setMembers((current) => current.map((item) => item.id === member.id ? { ...item, accessLevel } : item)); setNotice(`${member.name}님의 아카이브 등급을 변경했습니다.`); }
    else setNotice("아카이브 등급을 변경하지 못했습니다.");
  }

  const serviceOptions = form.type === "attendance" ? ["주일예배", "수요예배", "특별예배"] : ["주일 1부 예배", "주일 2부 예배", "수요예배", "특별예배"];
  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <main className="admin-shell admin-members-shell archive-admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/" aria-label="모현제일교회 홈페이지"><img src="/assets/logo-horizontal.png" alt="모현제일교회" /><span>WEBSITE ADMIN</span></Link>
        <nav aria-label="관리 메뉴"><a href="/admin?section=bulletin"><i>01</i><span>콘텐츠 관리</span></a><a href="/admin/members"><i>02</i><span>회원 관리</span></a><a className="is-active" href="/admin/archive"><i>03</i><span>예배 아카이브</span></a></nav>
        <div className="admin-account"><span>{userName}</span><small>{userEmail}</small><a href={signOutPath}>로그아웃</a></div>
      </aside>
      <section className="admin-workspace admin-members-workspace archive-admin-workspace">
        <header className="admin-topbar"><div><span>WORSHIP ARCHIVE</span><h1>예배 아카이브 관리</h1><p>유튜브 일부 공개 URL과 회원별 열람 등급을 한곳에서 관리합니다.</p></div><div><a href="/archive" target="_blank">아카이브 보기</a><button type="button" onClick={() => { setTab("videos"); setForm(emptyForm); }}>새 영상 등록</button></div></header>
        <div className="archive-admin-tabs"><button className={tab === "videos" ? "is-active" : ""} type="button" onClick={() => setTab("videos")}>영상 관리</button><button className={tab === "access" ? "is-active" : ""} type="button" onClick={() => setTab("access")}>열람 등급</button></div>
        {notice && <div className="admin-notice" role="status">{notice}</div>}
        {tab === "videos" ? <>
          <form className="archive-admin-form" onSubmit={save}>
            <h2>{form.id ? "영상 수정" : "새 영상 등록"}</h2>
            <label className="archive-youtube-field"><span>유튜브 URL</span><div><input value={form.youtubeUrl} onChange={(event) => update("youtubeUrl", event.target.value)} onBlur={() => void inspectYouTube()} placeholder="https://www.youtube.com/watch?v=..." required /><button type="button" onClick={() => void inspectYouTube()} disabled={loadingYoutube}>{loadingYoutube ? "확인 중" : "정보 불러오기"}</button></div><small>URL을 입력하면 구분, 날짜, 예배 종류, 제목, 길이와 썸네일을 자동으로 확인합니다.</small></label>
            <div className="archive-admin-field-grid"><label><span>구분</span><select value={form.type} onChange={(event) => { const type = event.target.value as FormState["type"]; setForm((current) => ({ ...current, type, serviceType: type === "attendance" ? "주일예배" : "주일 2부 예배" })); }}><option value="worship">예배 전체 실황</option><option value="attendance">교인 출석 현황</option></select></label><label><span>날짜</span><input type="date" value={form.date} onChange={(event) => update("date", event.target.value)} required /></label><label><span>예배 종류</span><select value={form.serviceType} onChange={(event) => update("serviceType", event.target.value)}>{serviceOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label><span>설교자</span><select value={form.preacher} onChange={(event) => update("preacher", event.target.value)}><option>담임목사</option><option>초청강사</option></select></label></div>
            <label><span>영상 제목</span><input value={form.title} onChange={(event) => update("title", event.target.value)} required /></label>
            <div className="archive-admin-field-grid"><label><span>영상 길이(초)</span><input type="number" min="0" value={form.durationSeconds} onChange={(event) => update("durationSeconds", event.target.value)} placeholder="자동 입력" /></label><label><span>썸네일 URL</span><input value={form.thumbnailUrl} onChange={(event) => update("thumbnailUrl", event.target.value)} placeholder="자동 입력" /></label></div>
            <label><span>비고</span><textarea value={form.note} onChange={(event) => update("note", event.target.value)} rows={3} /></label>
            <div className="archive-admin-form-actions">{form.id && <button type="button" onClick={() => setForm(emptyForm)}>수정 취소</button>}<button type="submit" disabled={saving}>{saving ? "저장 중" : form.id ? "수정 저장" : "영상 등록"}</button></div>
          </form>
          <section className="admin-list-panel archive-video-list"><header><div><h2>등록된 영상</h2><span>총 {total}개</span></div></header><div className="admin-table-wrap"><table><thead><tr><th>날짜</th><th>구분</th><th>제목</th><th>예배 종류</th><th>길이</th><th>관리</th></tr></thead><tbody>{videos.map((video) => <tr key={video.id}><td>{video.date}</td><td>{video.type === "attendance" ? "출석 기록" : "예배 실황"}</td><td><strong>{video.title}</strong></td><td>{video.serviceType}</td><td>{formatArchiveDuration(video.durationSeconds)}</td><td><div className="admin-row-actions"><button type="button" onClick={() => edit(video)}>수정</button><button type="button" onClick={() => void remove(video)}>삭제</button></div></td></tr>)}</tbody></table></div><footer className="archive-admin-pagination"><span>{total ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, total)} / 총 ${total}개` : "총 0개"}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>이전</button><b>{page} / {totalPages}페이지</b><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>다음</button></div></footer></section>
        </> : <section className="admin-list-panel archive-access-list"><header><div><h2>회원별 열람 등급</h2><span>총 {members.length}명</span></div></header><div className="admin-table-wrap"><table><thead><tr><th>회원</th><th>계정 상태</th><th>아카이브 등급</th><th>열람 범위</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><strong>{member.name}</strong><small>{member.username}</small></td><td>{member.status}</td><td><select value={member.accessLevel} onChange={(event) => void changeAccess(member, event.target.value as ArchiveAccessLevel)}><option value="none">권한 없음</option><option value="worship">예배 영상</option><option value="full">전체 기록</option></select></td><td>{accessLabels[member.accessLevel]}</td></tr>)}</tbody></table></div></section>}
      </section>
    </main>
  );
}
