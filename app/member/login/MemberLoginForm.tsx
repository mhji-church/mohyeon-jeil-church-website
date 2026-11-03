"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LOGIN_WAIT_FINISHED_MESSAGE, loginRetryDeadline, loginSecondsRemaining, loginWaitClock, loginWaitMessage } from "../../../lib/member-login-feedback";

export default function MemberLoginForm({ returnTo }: { returnTo: string }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const requestInFlight = useRef(false);
  const blocked = secondsLeft > 0;

  useEffect(() => {
    if (blockedUntil === null) return;
    const updateRemaining = () => {
      const remaining = loginSecondsRemaining(blockedUntil);
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setBlockedUntil(null);
        setError(LOGIN_WAIT_FINISHED_MESSAGE);
      }
    };
    const timer = window.setInterval(updateRemaining, 1000);
    document.addEventListener("visibilitychange", updateRemaining);
    window.addEventListener("focus", updateRemaining);
    window.addEventListener("pageshow", updateRemaining);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateRemaining);
      window.removeEventListener("focus", updateRemaining);
      window.removeEventListener("pageshow", updateRemaining);
    };
  }, [blockedUntil]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current || (blockedUntil !== null && Date.now() < blockedUntil)) return;
    requestInFlight.current = true;
    setBlockedUntil(null);
    setSecondsLeft(0);
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/members/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: String(form.get("username") ?? ""),
          password: String(form.get("password") ?? ""),
        }),
      });
      const receivedAt = Date.now();
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        forcePasswordChange?: boolean;
      } | null;
      if (!response.ok) {
        const deadline = response.status === 429 ? loginRetryDeadline(response.headers.get("retry-after"), receivedAt) : null;
        if (deadline !== null) {
          const remaining = loginSecondsRemaining(deadline);
          setBlockedUntil(remaining > 0 ? deadline : null);
          setSecondsLeft(remaining);
          setError(remaining > 0 ? loginWaitMessage(remaining) : LOGIN_WAIT_FINISHED_MESSAGE);
        } else {
          setError(data?.error ?? (response.status >= 500 ? "로그인 시스템에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요." : "로그인하지 못했습니다."));
        }
        return;
      }
      if (!data) throw new Error("invalid-login-response");
      window.location.assign(
        data.forcePasswordChange
          ? `/member/password?return_to=${encodeURIComponent(returnTo)}`
          : returnTo,
      );
    } catch {
      setError("로그인 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form className="member-form member-login-form" method="post" onSubmit={submit} aria-busy={submitting}>
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
        <small>가입하신 이름으로도 로그인할 수 있습니다.</small>
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
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{error}</span>
      {error && <p className="member-form-error" id="member-login-feedback" aria-live="off">{blocked ? loginWaitMessage(secondsLeft) : error}</p>}
      <button type="submit" disabled={submitting || blocked} data-login-blocked={blocked ? "true" : undefined} aria-label={blocked ? "로그인 제한 중. 대기 시간이 끝나면 다시 시도할 수 있습니다." : undefined} aria-describedby={error ? "member-login-feedback" : undefined}>
        <span aria-hidden={blocked || undefined}>{blocked ? `다시 시도까지 ${loginWaitClock(secondsLeft)}` : submitting ? "로그인 중…" : "교인 로그인"}</span>
      </button>
      <Link className="member-recovery-link" href="/member/recovery">비밀번호를 잊으셨나요?</Link>
      <small className="member-login-help">동명이인으로 로그인하기 어렵다면 기존 아이디를 입력하거나 관리자에게 문의해 주세요. 기존 아이디와 일치하는 입력은 아이디 로그인을 우선합니다.</small>
    </form>
  );
}
