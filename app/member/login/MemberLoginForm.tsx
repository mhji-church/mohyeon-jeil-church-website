"use client";

import { FormEvent, useState } from "react";

export default function MemberLoginForm({ returnTo }: { returnTo: string }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/members/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? ""),
      }),
    });
    const data = (await response.json()) as {
      error?: string;
      forcePasswordChange?: boolean;
    };
    if (!response.ok) {
      setError(data.error ?? "로그인하지 못했습니다.");
      setSubmitting(false);
      return;
    }
    window.location.assign(
      data.forcePasswordChange
        ? `/member/password?return_to=${encodeURIComponent(returnTo)}`
        : returnTo,
    );
  }

  return (
    <form className="member-form member-login-form" onSubmit={submit}>
      <label>
        <span>이름 또는 기존 아이디</span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          required
          autoFocus
        />
        <small>새로 가입한 회원은 이름을 입력해 주세요.</small>
      </label>
      <label>
        <span>비밀번호</span>
        <span className="member-password-input">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
          />
          <button type="button" onClick={() => setShowPassword((current) => !current)}>
            {showPassword ? "숨기기" : "보기"}
          </button>
        </span>
      </label>
      {error && <p className="member-form-error" role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "로그인 중…" : "교인 로그인"}
      </button>
    </form>
  );
}
