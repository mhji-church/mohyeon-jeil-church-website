"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";

export default function PasswordChangeForm({ returnTo }: { returnTo: string }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [complete, setComplete] = useState(false);
  const inFlight = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmation") ?? "")) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    inFlight.current = true;
    try {
    const response = await fetch("/api/members/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(data?.error ?? "비밀번호를 변경하지 못했습니다.");
      return;
    }
    setComplete(true);
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } finally { inFlight.current = false; setSubmitting(false); }
  }

  if (complete) return <div className="member-recovery-result" role="status"><p>비밀번호가 변경되었습니다. 이름 또는 기존 아이디와 새 비밀번호로 로그인해 주세요.</p><Link className="member-recovery-link" href={`/member/login?return_to=${encodeURIComponent(returnTo)}`}>로그인 화면으로 이동</Link></div>;

  return (
    <form className="member-form member-login-form" method="post" onSubmit={submit} aria-busy={submitting}>
      <label>
        <span>새 비밀번호</span>
        <input name="password" type={showPassword ? "text" : "password"} minLength={6} maxLength={72} autoComplete="new-password" required autoFocus />
      </label>
      <label>
        <span>새 비밀번호 확인</span>
        <input name="confirmation" type={showPassword ? "text" : "password"} minLength={6} maxLength={72} autoComplete="new-password" required />
      </label>
      <label><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />비밀번호 표시</label>
      {error && <p className="member-form-error" role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "변경 중…" : "새 비밀번호 저장"}
      </button>
    </form>
  );
}
