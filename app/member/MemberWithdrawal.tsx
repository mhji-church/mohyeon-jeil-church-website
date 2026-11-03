"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import AccessibleDialog from "../components/AccessibleDialog";
import { loginRetryDeadline, loginSecondsRemaining } from "../../lib/member-login-feedback";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function MemberWithdrawal({ onComplete }: { onComplete: () => void }) {
  const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [limited, setLimited] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!deadline) return;
    const refresh = () => { if (loginSecondsRemaining(deadline) === 0) { setLimited(false); setDeadline(null); } };
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [deadline]);

  function close() {
    if (inFlight.current) return;
    setOpen(false); setPassword(""); setConfirmed(false); setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !confirmed || !password || (deadline && Date.now() < deadline)) return;
    inFlight.current = true;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/members/withdrawal", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, confirmed: true }),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || data?.ok !== true) {
        if (response.status === 429) {
          const until = loginRetryDeadline(response.headers.get("Retry-After"));
          setDeadline(until); setLimited(until !== null);
        }
        setError(data?.error ?? "탈퇴를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setPassword(""); setOpen(false);
      window.dispatchEvent(new Event("member-profile-updated"));
      onComplete();
    } catch { setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return (
    <div className="member-withdrawal-entry">
      <button type="button" disabled={!ready} onClick={() => setOpen(true)}>회원 탈퇴</button>
      <AccessibleDialog open={open} onClose={close} labelledBy="withdrawal-title" describedBy="withdrawal-notice" className="member-withdrawal-dialog">
        <header><h2 id="withdrawal-title">회원 탈퇴</h2><button type="button" aria-label="회원 탈퇴 창 닫기" onClick={close} disabled={busy}>×</button></header>
        <p id="withdrawal-notice">탈퇴하면 회원정보와 로그인 계정이 삭제되며 복구할 수 없습니다. 다시 이용하려면 새로 가입해야 합니다.</p>
        <p className="member-withdrawal-hint">병합한 계정은 모든 기존 아이디가 함께 삭제됩니다.</p>
        <form className="member-form" method="post" onSubmit={submit} aria-busy={busy}>
          <label><span>현재 비밀번호</span><input name="withdrawalPassword" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} maxLength={72} required disabled={busy} /></label>
          <label className="member-withdrawal-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} /><span>탈퇴 안내를 확인했습니다</span></label>
          {error && <p className="member-form-error" role="alert">{error}</p>}
          <div className="member-withdrawal-actions"><button type="button" data-dialog-autofocus onClick={close} disabled={busy}>취소</button><button type="submit" disabled={!password || !confirmed || busy || limited}>{busy ? "탈퇴 처리 중…" : "회원 탈퇴"}</button></div>
        </form>
      </AccessibleDialog>
    </div>
  );
}
