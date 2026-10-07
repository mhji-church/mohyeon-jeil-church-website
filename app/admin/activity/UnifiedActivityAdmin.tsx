"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminPagination from "../AdminPagination";
import AdminSidebar from "../AdminSidebar";
import { formatAdminAuditTime } from "@/lib/admin-audit-time";

type Log = {
  id: string;
  actorId: string;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, string>;
  createdAt: string;
};

const actionGroups = [
  ["", "전체 작업"],
  ["admin.login", "관리자 로그인"],
  ["member.login", "회원 로그인"],
  ["content.create", "콘텐츠 생성"],
  ["content.update", "콘텐츠 수정"],
  ["content.delete", "콘텐츠 삭제"],
  ["member.update", "회원 수정"],
  ["member.password_reset", "임시 비밀번호 발급"],
  ["member.password_change", "비밀번호 변경"],
  ["member.merge", "회원 계정 병합"],
  ["member.delete", "회원 삭제"],
  ["archive.video.create", "예배 영상 등록"],
  ["archive.video.update", "예배 영상 수정"],
  ["archive.video.delete", "예배 영상 삭제"],
  ["archive.access.update", "예배 아카이브 권한 변경"],
  ["archive.settings.update", "아카이브 설정 변경"],
  ["archive.song.merge", "찬양곡 병합"],
] as const;

const activityCategories = [
  ["", "전체"], ["login", "로그인"], ["member", "회원"], ["content", "콘텐츠"], ["archive", "아카이브"],
] as const;

const actionLabels: Record<string, string> = {
  "admin.login": "관리자 로그인",
  "member.login": "회원 로그인",
  "content.create": "콘텐츠 생성",
  "content.update": "콘텐츠 수정",
  "content.delete": "콘텐츠 삭제",
  "member.update": "회원 정보 수정",
  "member.password_reset": "임시 비밀번호 발급",
  "member.password_change": "비밀번호 변경",
  "member.delete": "회원 삭제",
  "member.merge": "회원 계정 병합",
  "archive.access.update": "예배 아카이브 권한 변경",
  "archive.video.create": "예배 영상 등록",
  "archive.video.update": "예배 영상 수정",
  "archive.video.delete": "예배 영상 삭제",
  "archive.settings.update": "아카이브 설정 변경",
  "archive.song.merge": "찬양곡 병합",
};

const targetLabels: Record<string, string> = {
  content: "게시물",
  bulletin: "주보", news: "교회소식", gallery: "갤러리", business: "성도사업장",
  member: "회원 계정", member_merge: "회원 계정 병합", archive_video: "예배 영상",
  archive_song: "찬양곡", archive_settings: "아카이브 설정",
};
const accessLabels: Record<string, string> = { none: "권한 없음", worship: "예배 영상", full: "전체 기록" };
const memberStatusLabels: Record<string, string> = { pending: "승인 대기", approved: "승인", suspended: "이용 중지" };

function displayAction(action: string) {
  return actionLabels[action] ?? action;
}

function displayAccount(log: Log) {
  return log.action === "member.login" ? `회원 · ${log.actorName ?? log.actorId}` : `관리자 · ${log.actorId}`;
}

function displayTargetSummary(log: Log) {
  if (log.action === "member.login") return "회원 계정 접속";
  if (log.action === "admin.login") return "관리자 계정 접속";
  if (log.action === "archive.access.update") {
    const level = accessLabels[log.metadata.accessLevel];
    return level ? `회원 열람 권한 · ${level}` : log.metadata.summary ?? "회원 열람 권한 변경";
  }
  if (log.action.startsWith("archive.") && log.metadata.summary) return log.metadata.summary;
  const target = targetLabels[log.targetType] ?? log.targetType ?? "기록";
  if (log.action.startsWith("content.") && log.metadata.date) return `${target} · ${log.metadata.date}`;
  if (log.action === "member.update" && log.metadata.status) return `${target} · ${memberStatusLabels[log.metadata.status] ?? log.metadata.status}`;
  return target || "기록";
}

const metadataLabels: Record<string, string> = { ipAddress: "IP 주소", device: "사용 기기" };
function ActivityTime({ value }: { value: string }) {
  const formatted = formatAdminAuditTime(value);
  const [date, ...time] = formatted.split(" ");
  return <time title={formatted}><span>{date}</span><small>{time.join(" ")}</small></time>;
}

export default function UnifiedActivityAdmin(props: {
  userName: string;
  userEmail: string;
  signOutPath: string;
  initialPendingMemberCount: number | null;
  canManageArchive: boolean;
  canViewAnalytics: boolean;
}) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [group, setGroup] = useState("");
  const [failed, setFailed] = useState(false);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const detailDialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const closeDetail = useCallback(() => {
    setSelectedLog(null);
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!selectedLog) return;
    const dialog = detailDialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])")];
    focusable()[0]?.focus();
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDetail();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", handleKeys);
    return () => {
      dialog.removeEventListener("keydown", handleKeys);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeDetail, selectedLog]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), q: query, action, group });
    try {
      const response = await fetch(`/api/admin/activity?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("activity-list-failed");
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [action, group, page, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <main className="admin-shell admin-members-shell">
      <AdminSidebar active="activity" canManageWebsite {...props} />
      <section className="admin-workspace admin-members-workspace">
        <header className="admin-topbar admin-activity-topbar">
          <div><span>ADMIN ACTIVITY</span><h1>활동 기록</h1><p>관리 작업과 관리자·회원 로그인 이력을 확인합니다.</p></div>
          <div><button type="button" onClick={() => void load()}>목록 새로고침</button></div>
        </header>
        <section className="admin-list-panel admin-activity-panel">
          <header>
            <div><h2>활동 기록 목록</h2><span>총 {total}개</span></div>
            <div className="admin-activity-toolbar">
              <label><span className="sr-only">활동 기록 검색</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="계정·작업·대상·IP 검색" /></label>
              <label><span className="sr-only">작업 유형 필터</span><select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }}>
                {actionGroups.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select></label>
            </div>
          </header>
          <div className="admin-activity-categories" role="group" aria-label="작업 범주">
            {activityCategories.map(([value, label]) => <button key={value} type="button" aria-pressed={group === value} onClick={() => { setGroup(value); setAction(""); setPage(1); }}>{label}</button>)}
          </div>
          {failed ? <div className="admin-empty"><strong>활동 기록을 불러오지 못했습니다.</strong></div> : (
            <div className="admin-table-wrap"><table className="admin-activity-table"><thead><tr><th>시각</th><th>계정</th><th>작업</th><th>대상·내용</th><th><span className="sr-only">상세</span></th></tr></thead><tbody>
              {logs.map((log) => <tr key={log.id}><td><ActivityTime value={log.createdAt} /></td><td>{displayAccount(log)}</td><td><strong>{displayAction(log.action)}</strong></td><td className="admin-activity-summary">{displayTargetSummary(log)}</td><td><button className="admin-activity-detail-button" type="button" aria-label={`${displayAction(log.action)} 상세`} onClick={(event) => { returnFocusRef.current = event.currentTarget; setSelectedLog(log); }}>상세</button></td></tr>)}
            </tbody></table>{!logs.length && <div className="admin-empty"><strong>조건에 맞는 활동 기록이 없습니다.</strong></div>}</div>
          )}
          <AdminPagination currentPage={page} totalPages={pages} onPageChange={setPage} />
        </section>
      </section>
      {selectedLog && (
        <div className="admin-confirm-backdrop admin-activity-detail-backdrop" role="dialog" aria-modal="true" aria-label="활동 기록 상세">
          <section className="admin-activity-detail-sheet" ref={detailDialogRef}>
            <header>
              <div><span>ACTIVITY DETAIL</span><h2>{displayAction(selectedLog.action)}</h2></div>
              <button type="button" aria-label="활동 기록 상세 닫기" onClick={closeDetail}>×</button>
            </header>
            <div>
              <dl>
                <div><dt>시각</dt><dd>{formatAdminAuditTime(selectedLog.createdAt)}</dd></div>
                <div><dt>계정</dt><dd>{displayAccount(selectedLog)}</dd></div>
                <div><dt>대상</dt><dd>{selectedLog.targetType}{selectedLog.targetId ? ` · ${selectedLog.targetId}` : ""}</dd></div>
                <div><dt>작업 코드</dt><dd><code>{selectedLog.action}</code></dd></div>
                <div><dt>접속 정보·메타데이터</dt><dd>{Object.entries(selectedLog.metadata).map(([key, value]) => <span key={key}><b>{metadataLabels[key] ?? key}</b>{value}</span>)}{!Object.keys(selectedLog.metadata).length && "—"}</dd></div>
              </dl>
            </div>
            <footer><button type="button" onClick={closeDetail}>닫기</button></footer>
          </section>
        </div>
      )}
    </main>
  );
}
