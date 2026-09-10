"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminPagination from "../AdminPagination";
import AdminSidebar from "../AdminSidebar";

type Log = {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, string>;
  createdAt: string;
};

const actionGroups = [
  ["", "전체 작업"],
  ["content.create", "콘텐츠 생성"],
  ["content.update", "콘텐츠 수정"],
  ["content.delete", "콘텐츠 삭제"],
  ["member.update", "회원 수정"],
  ["member.password_reset", "임시 비밀번호 발급"],
  ["member.delete", "회원 삭제"],
] as const;

const actionLabels: Record<string, string> = {
  "content.create": "콘텐츠 생성",
  "content.update": "콘텐츠 수정",
  "content.delete": "콘텐츠 삭제",
  "member.update": "회원 정보 수정",
  "member.password_reset": "임시 비밀번호 발급",
  "member.delete": "회원 삭제",
  "member.merge": "회원 계정 병합",
  "archive.access.update": "예배 아카이브 권한 변경",
};

function displayAction(action: string) {
  return actionLabels[action] ?? action;
}

export default function UnifiedActivityAdmin(props: {
  userName: string;
  userEmail: string;
  signOutPath: string;
  initialPendingMemberCount: number | null;
  canManageArchive: boolean;
}) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
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
    const params = new URLSearchParams({ page: String(page), q: query, action });
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
  }, [action, page, query]);

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
          <div><span>ADMIN ACTIVITY</span><h1>활동 기록</h1><p>관리자 변경 이력을 민감정보 없이 확인합니다.</p></div>
          <div><button type="button" onClick={() => void load()}>목록 새로고침</button></div>
        </header>
        <section className="admin-list-panel admin-activity-panel">
          <header>
            <div><h2>활동 기록 목록</h2><span>총 {total}개</span></div>
            <div className="admin-activity-toolbar">
              <label><span className="sr-only">활동 기록 검색</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="관리자·작업·대상 검색" /></label>
              <label><span className="sr-only">작업 유형 필터</span><select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }}>
                {actionGroups.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select></label>
            </div>
          </header>
          {failed ? <div className="admin-empty"><strong>활동 기록을 불러오지 못했습니다.</strong></div> : (
            <div className="admin-table-wrap"><table className="admin-activity-table"><thead><tr><th>시각</th><th>관리자</th><th>작업</th><th>대상</th><th>메타데이터</th><th><span className="sr-only">상세</span></th></tr></thead><tbody>
              {logs.map((log) => <tr key={log.id}><td>{log.createdAt.replace("T", " ")}</td><td>{log.actorId}</td><td><strong>{displayAction(log.action)}</strong><small>{actionLabels[log.action] ? "" : log.action}</small></td><td>{log.targetType}{log.targetId ? ` · ${log.targetId}` : ""}</td><td>{Object.entries(log.metadata).map(([key, value]) => `${key}: ${value}`).join(" · ") || "—"}</td><td><button className="admin-activity-detail-button" type="button" onClick={(event) => { returnFocusRef.current = event.currentTarget; setSelectedLog(log); }}>상세</button></td></tr>)}
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
                <div><dt>시각</dt><dd>{selectedLog.createdAt.replace("T", " ")}</dd></div>
                <div><dt>관리자</dt><dd>{selectedLog.actorId}</dd></div>
                <div><dt>대상</dt><dd>{selectedLog.targetType}{selectedLog.targetId ? ` · ${selectedLog.targetId}` : ""}</dd></div>
                <div><dt>작업 코드</dt><dd><code>{selectedLog.action}</code></dd></div>
                <div><dt>메타데이터</dt><dd>{Object.entries(selectedLog.metadata).map(([key, value]) => <span key={key}><b>{key}</b>{value}</span>)}{!Object.keys(selectedLog.metadata).length && "—"}</dd></div>
              </dl>
            </div>
            <footer><button type="button" onClick={closeDetail}>닫기</button></footer>
          </section>
        </div>
      )}
    </main>
  );
}
