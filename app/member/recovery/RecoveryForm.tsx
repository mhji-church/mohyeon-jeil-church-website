"use client";

import { useCallback, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function RecoveryForm() {
  const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"identity" | "password" | "complete">("identity");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const focusStep = useCallback((element: HTMLElement | null) => element?.focus(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || step === "complete") return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (step === "password" && fields.get("password") !== fields.get("confirmation")) { setError("비밀번호 확인이 일치하지 않습니다."); return; }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(step === "identity" ? "/api/members/recovery" : "/api/members/recovery/complete", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(step === "identity" ? { name: String(fields.get("name") ?? ""), birthDate: String(fields.get("birthDate") ?? "") } : { password: String(fields.get("password") ?? ""), confirmation: String(fields.get("confirmation") ?? "") }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) { setError(data?.error ?? "요청하지 못했습니다. 잠시 후 다시 시도해 주세요."); return; }
      form.reset();
      if (step === "password") window.dispatchEvent(new Event("member-profile-updated"));
      setStep(step === "identity" ? "password" : "complete");
    } catch {
      setError("재설정 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  return (
    <>
      {step === "complete" ? <div className="member-recovery-result" role="status" tabIndex={-1} ref={focusStep}><p>비밀번호가 변경되었습니다. 이름 또는 기존 아이디와 새 비밀번호로 로그인해 주세요.</p><Link className="member-recovery-link" href="/member/login">로그인 화면으로 이동</Link></div> :
        <form key={step} className="member-form" method="post" onSubmit={submit} aria-busy={busy}>
          {step === "identity" ? <>
          <p id="recovery-help">가입하신 이름과 생년월일 6자리를 입력해 주세요.</p>
          <label><span>이름</span><input name="name" autoComplete="name" required minLength={2} maxLength={100} aria-describedby="recovery-help" /></label>
          <label><span id="recovery-birth-label">생년월일 6자리</span><input name="birthDate" type="text" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="예: 041225" autoComplete="off" required aria-labelledby="recovery-birth-label" aria-describedby="recovery-birth-help" /><small id="recovery-birth-help">연도 뒤 2자리·월·일을 입력해 주세요. 예: 2004년 12월 25일 → 041225</small></label>
          </> : <>
            <p tabIndex={-1} ref={focusStep}>새 비밀번호를 입력해 주세요. 5분 안에 완료해 주세요.</p>
            <label><span>새 비밀번호</span><input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={6} maxLength={72} required /></label>
            <label><span>새 비밀번호 확인</span><input name="confirmation" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={6} maxLength={72} required /></label>
            <label><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />비밀번호 표시</label>
          </>}
          {error && <p className="member-form-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy || !ready}>{busy ? "처리 중…" : step === "identity" ? "다음" : "새 비밀번호 저장"}</button>
          {step === "password" && <button className="member-recovery-back" type="button" disabled={busy} onClick={() => { setStep("identity"); setShowPassword(false); setError(""); }}>처음부터 다시 입력</button>}
        </form>}
    </>
  );
}
