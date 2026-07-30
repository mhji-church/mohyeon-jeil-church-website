"use client";

import { FormEvent, useState } from "react";

export default function PasswordChangeForm({ returnTo }: { returnTo: string }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmation") ?? "")) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    const response = await fetch("/api/members/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "비밀번호를 변경하지 못했습니다.");
      setSubmitting(false);
      return;
    }
    window.location.assign(returnTo);
  }

  return (
    <form className="member-form member-login-form" onSubmit={submit}>
      <label>
        <span>새 비밀번호</span>
        <input name="password" type="password" minLength={6} required autoFocus />
      </label>
      <label>
        <span>새 비밀번호 확인</span>
        <input name="confirmation" type="password" minLength={6} required />
      </label>
      {error && <p className="member-form-error" role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "변경 중…" : "새 비밀번호 저장"}
      </button>
    </form>
  );
}
