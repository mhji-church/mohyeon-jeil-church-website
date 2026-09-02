"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function UnifiedActivityAdmin(props: {
  userName: string;
  userEmail: string;
  signOutPath: string;
  initialPendingMemberCount: number | null;
}) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [failed, setFailed] = useState(false);

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
      <AdminSidebar active="activity" {...props} />
      <section className="admin-workspace admin-members-workspace">
        <header className="admin-members-header">
          <div><span>ADMIN ACTIVITY</span><h1>활동 기록</h1><p>관리자 변경 이력을 민감정보 없이 확인합니다.</p></div>
          <button type="button" onClick={() => void load()}>목록 새로고침</button>
        </header>
        <section className="admin-members-panel">
          <div className="admin-member-toolbar">
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="관리자·작업·대상 검색" aria-label="활동 기록 검색" />
            <select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} aria-label="작업 유형 필터">
              {actionGroups.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </div>
          {failed ? <div className="admin-empty"><strong>활동 기록을 불러오지 못했습니다.</strong></div> : (
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>시각</th><th>관리자</th><th>작업</th><th>대상</th><th>메타데이터</th></tr></thead><tbody>
              {logs.map((log) => <tr key={log.id}><td>{log.createdAt.replace("T", " ")}</td><td>{log.actorId}</td><td>{log.action}</td><td>{log.targetType}{log.targetId ? ` · ${log.targetId}` : ""}</td><td>{Object.entries(log.metadata).map(([key, value]) => `${key}: ${value}`).join(" · ") || "—"}</td></tr>)}
            </tbody></table>{!logs.length && <div className="admin-empty"><strong>조건에 맞는 활동 기록이 없습니다.</strong></div>}</div>
          )}
          <div className="admin-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>이전</button><span>{page} / {pages} · 총 {total}개</span><button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>다음</button></div>
        </section>
      </section>
    </main>
  );
}
