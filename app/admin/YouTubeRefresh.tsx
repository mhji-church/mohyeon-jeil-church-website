"use client";

import { useEffect, useRef, useState } from "react";

function koreaTime(value: string | null) {
  if (!value) return "성공 기록 없음";
  const date = new Date(value.replace(" ", "T") + (/[Z+]/.test(value) ? "" : "Z"));
  return Number.isNaN(date.getTime()) ? "시각 확인 불가" : new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "medium" }).format(date);
}

export default function YouTubeRefresh() {
  const [busy, setBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [statusError, setStatusError] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/youtube/sync", { cache: "no-store", signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => setUpdatedAt(data.updatedAt))
      .catch(() => { if (!controller.signal.aborted) setStatusError(true); });
    return () => controller.abort();
  }, []);
  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/youtube/sync", { method: "POST" });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || "새로고침하지 못했습니다."); return; }
      setUpdatedAt(data.updatedAt); setStatusError(false);
      setMessage(`영상 ${data.count}개 반영 완료 · ${koreaTime(data.updatedAt)} (한국 시간)`);
    } catch { setMessage("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="admin-youtube-refresh" aria-label="설교 재생목록 동기화">
    <span className="sr-only" id="youtube-refresh-help">설교 재생목록의 최신 내용을 홈페이지에 반영합니다. {statusError ? "마지막 동기화 시각 조회 실패" : `마지막 성공: ${koreaTime(updatedAt)}${updatedAt ? " (한국 시간)" : ""}`}</span>
    <button type="button" disabled={busy} aria-describedby="youtube-refresh-help" title={`설교 재생목록의 최신 내용을 홈페이지에 반영합니다. ${statusError ? "마지막 동기화 시각 조회 실패" : `마지막 성공: ${koreaTime(updatedAt)}${updatedAt ? " (한국 시간)" : ""}`}`} onClick={refresh}>{busy ? "새로고침 중…" : "유튜브 목록 새로고침"}</button>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
