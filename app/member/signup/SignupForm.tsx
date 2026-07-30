"use client";

import { FormEvent, useState } from "react";
import { formatMobilePhone } from "../../../lib/phone";

export default function SignupForm() {
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("passwordConfirmation") ?? "");
    if (password !== confirmation) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    const response = await fetch("/api/members/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: String(form.get("username") ?? ""),
        password,
        name: String(form.get("name") ?? ""),
        phone: String(form.get("phone") ?? ""),
        birthDate: String(form.get("birthDate") ?? ""),
        position: String(form.get("position") ?? ""),
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "가입 신청을 처리하지 못했습니다.");
      setSubmitting(false);
      return;
    }
    setComplete(true);
  }

  if (complete) {
    return (
      <div className="member-signup-complete" role="status">
        <span aria-hidden="true">✓</span>
        <h2>가입 신청이 완료됐습니다</h2>
        <p>
          관리자가 교인 여부를 확인하고 승인하면 로그인할 수 있습니다.
          승인 여부는 교회 관리자에게 문의해 주세요.
        </p>
        <a href="/member/login">로그인 화면으로 이동</a>
      </div>
    );
  }

  return (
    <form className="member-form" onSubmit={submit}>
      <div className="member-field-row">
        <label>
          <span>이름 <b>*</b></span>
          <input name="name" type="text" autoComplete="name" required />
        </label>
        <label>
          <span>아이디 <b>*</b></span>
          <input
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            pattern="[A-Za-z0-9._-]{4,30}"
            required
          />
          <small>영문 소문자·숫자 4~30자, 마침표·밑줄·하이픈 사용 가능</small>
        </label>
      </div>
      <div className="member-field-row">
        <label>
          <span>비밀번호 <b>*</b></span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
          />
          <small>6자 이상 입력해 주세요.</small>
        </label>
        <label>
          <span>비밀번호 확인 <b>*</b></span>
          <input
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>
      </div>
      <div className="member-field-row">
        <label>
          <span>휴대전화 <b>*</b></span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="numeric"
            placeholder="010-0000-0000"
            pattern="010-[0-9]{4}-[0-9]{4}"
            maxLength={13}
            title="010-0000-0000 형식으로 입력해 주세요."
            onInput={(event) => {
              event.currentTarget.value = formatMobilePhone(
                event.currentTarget.value,
              );
            }}
            required
          />
          <small>숫자만 입력해도 하이픈이 자동으로 추가됩니다.</small>
        </label>
        <label>
          <span>생년월일</span>
          <input name="birthDate" type="date" autoComplete="bday" />
        </label>
      </div>
      <label>
        <span>직분 또는 소속 부서</span>
        <input
          name="position"
          type="text"
          placeholder="예: 집사, 청년부, 새가족"
          maxLength={40}
        />
      </label>
      <label className="member-consent">
        <input name="consent" type="checkbox" required />
        <span>
          회원 확인과 홈페이지 이용을 위해 이름·연락처 등 가입 정보를 수집·이용하는
          것에 동의합니다. <b>*</b>
        </span>
      </label>
      {error && <p className="member-form-error" role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "가입 신청 중…" : "회원가입 신청"}
      </button>
    </form>
  );
}
