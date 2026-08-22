"use client";
import { FormEvent, useState } from "react";

export default function ArchiveAdminLoginForm({ returnTo }: { returnTo: string }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/archive/admin/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password"), returnTo }) });
    const data = await response.json() as { error?: string; returnTo?: string };
    if (!response.ok) { setError(data.error ?? "로그인하지 못했습니다."); setBusy(false); return; }
    location.assign(data.returnTo ?? "/archive/admin");
  }
  return <form className="archive-admin-login-form" onSubmit={submit}><label><span>관리자 아이디</span><input name="username" autoComplete="username" required autoFocus /></label><label><span>비밀번호</span><input name="password" type="password" autoComplete="current-password" required /></label>{error && <p role="alert">{error}</p>}<button className="primary-btn" disabled={busy}>{busy ? "확인 중…" : "아카이브 관리자 로그인"}</button></form>;
}
