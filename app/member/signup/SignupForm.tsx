"use client";

import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import AccessibleDialog from "../../components/AccessibleDialog";
import {
  validateMemberBirthDate,
  validateNewMemberPassword,
} from "../../../lib/member-signup";
import { formatMobilePhone, normalizeMobilePhone } from "../../../lib/phone";

const SIGNUP_COMPLETE_KEY = "mhji-member-signup-completed";

type FieldName =
  | "name"
  | "phone"
  | "birthDate"
  | "password"
  | "passwordConfirmation"
  | "consent";

type FieldErrors = Partial<Record<FieldName, string>>;

export default function SignupForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState({
    name: "",
    phone: "",
    position: "",
    password: "",
    passwordConfirmation: "",
    consent: false,
  });
  const [date, setDate] = useState({ year: "", month: "", day: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [completeUsername, setCompleteUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    const current = new URL(window.location.href);
    if (current.searchParams.get("guide") !== "1") return;
    const timer = window.setTimeout(() => setGuideOpen(true), 0);
    current.searchParams.delete("guide");
    window.history.replaceState(
      {},
      "",
      `${current.pathname}${current.search}${current.hash}`,
    );
    return () => window.clearTimeout(timer);
  }, []);

  const birthDate = `${date.year}-${date.month}-${date.day}`;

  function updateDatePart(
    part: "year" | "month" | "day",
    rawValue: string,
  ) {
    const limit = part === "year" ? 4 : 2;
    const digits = rawValue.replace(/\D/g, "").slice(0, limit);
    setDate((current) => ({ ...current, [part]: digits }));
    setErrors((current) => ({ ...current, birthDate: undefined }));
    if (part === "year" && digits.length === 4) monthRef.current?.focus();
    if (part === "month" && digits.length === 2) dayRef.current?.focus();
  }

  function pasteDate(event: ClipboardEvent<HTMLInputElement>) {
    const digits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (digits.length !== 8) return;
    event.preventDefault();
    setDate({
      year: digits.slice(0, 4),
      month: digits.slice(4, 6),
      day: digits.slice(6, 8),
    });
    setErrors((current) => ({ ...current, birthDate: undefined }));
    window.setTimeout(() => dayRef.current?.focus(), 0);
  }

  function normalizeShortDatePart(part: "month" | "day") {
    setDate((current) => ({
      ...current,
      [part]: current[part].length === 1 ? current[part].padStart(2, "0") : current[part],
    }));
  }

  function moveBackOnEmpty(
    event: KeyboardEvent<HTMLInputElement>,
    previous: RefObject<HTMLInputElement | null>,
  ) {
    if (event.key === "Backspace" && !event.currentTarget.value) {
      previous.current?.focus();
    }
  }

  function validate() {
    const nextErrors: FieldErrors = {};
    const name = values.name.trim().replace(/\s+/g, " ");
    const phone = normalizeMobilePhone(values.phone);
    const checkedBirthDate = validateMemberBirthDate(birthDate);

    if (name.length < 2 || name.length > 30) {
      nextErrors.name = "이름을 2~30자로 입력해 주세요.";
    }
    if (!phone) nextErrors.phone = "휴대전화 번호 11자리를 확인해 주세요.";
    if (!checkedBirthDate.value) nextErrors.birthDate = checkedBirthDate.error;
    if (phone && checkedBirthDate.value) {
      const checkedPassword = validateNewMemberPassword(
        values.password,
        checkedBirthDate.value,
        phone,
      );
      if (!checkedPassword.value) nextErrors.password = checkedPassword.error;
    } else if (!/^\d{6}$/.test(values.password)) {
      nextErrors.password = "로그인 비밀번호는 숫자 6자리로 입력해 주세요.";
    }
    if (values.password !== values.passwordConfirmation) {
      nextErrors.passwordConfirmation = "비밀번호가 서로 다릅니다. 다시 확인해 주세요.";
    }
    if (!values.consent) {
      nextErrors.consent = "개인정보 수집·이용 동의가 필요합니다.";
    }
    return { errors: nextErrors, phone, checkedBirthDate };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    const checked = validate();
    setErrors(checked.errors);
    if (Object.keys(checked.errors).length || !checked.phone || !checked.checkedBirthDate.value) {
      setError("입력 내용을 다시 확인해 주세요. 잘못된 항목을 바로 안내해 드립니다.");
      window.requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>("[aria-invalid='true']")
          ?.focus();
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/members/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password: values.password,
          name: values.name,
          phone: checked.phone,
          birthDate: checked.checkedBirthDate.value,
          position: values.position,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        username?: string;
      };
      if (!response.ok || !data.username) {
        setError(data.error ?? "가입 신청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
        return;
      }
      try {
        window.localStorage.setItem(SIGNUP_COMPLETE_KEY, "1");
      } catch {
        // Signup remains complete even when browser storage is unavailable.
      }
      setCompleteUsername(data.username);
    } catch {
      setError("인터넷 연결을 확인한 뒤 다시 신청해 주세요.");
      window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  }

  if (completeUsername) {
    return (
      <div className="member-signup-complete" role="status">
        <span aria-hidden="true">✓</span>
        <h2>회원가입 신청이 완료됐습니다.</h2>
        <p>
          지금 바로 로그인할 수 있습니다.<br />
          갤러리 등 회원 전용 콘텐츠는 관리자 승인 후 볼 수 있습니다.<br />
          로그인할 때 아래 이름을 입력해 주세요.
        </p>
        <strong className="member-complete-login-name">{completeUsername}</strong>
        <p className="member-complete-reminder">화면을 캡처하거나 종이에 적어두세요.</p>
        <div className="member-complete-actions">
          <Link href="/">홈페이지로 돌아가기</Link>
          <Link href="/member/login">로그인 화면으로 이동</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        className="member-guide-trigger"
        type="button"
        onClick={() => setGuideOpen(true)}
      >
        가입 방법 보기
      </button>
      <form ref={formRef} className="member-form member-signup-form" onSubmit={submit} noValidate>
        {error && (
          <div
            ref={errorSummaryRef}
            className="member-form-error"
            role="alert"
            aria-live="assertive"
            tabIndex={-1}
          >
            {error}
          </div>
        )}

        <label>
          <span>이름 <b>*</b></span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            value={values.name}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "signup-name-error" : "signup-name-help"}
            onChange={(event) => {
              setValues((current) => ({ ...current, name: event.target.value }));
              setErrors((current) => ({ ...current, name: undefined }));
            }}
            required
          />
          <small id="signup-name-help">가입 승인 후 이름으로 로그인합니다.</small>
          {errors.name && <small className="member-field-error" id="signup-name-error">{errors.name}</small>}
        </label>

        <label>
          <span>휴대전화 번호 <b>*</b></span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="numeric"
            placeholder="010-0000-0000"
            maxLength={13}
            value={values.phone}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "signup-phone-error" : "signup-phone-help"}
            onChange={(event) => {
              setValues((current) => ({
                ...current,
                phone: formatMobilePhone(event.target.value),
              }));
              setErrors((current) => ({ ...current, phone: undefined }));
            }}
            required
          />
          <small id="signup-phone-help">숫자만 입력해도 하이픈이 자동으로 추가됩니다.</small>
          {errors.phone && <small className="member-field-error" id="signup-phone-error">{errors.phone}</small>}
        </label>

        <fieldset className="member-birthdate-fieldset">
          <legend>생년월일 <b>*</b></legend>
          <div className="member-birthdate-inputs">
            <label>
              <span><b>출생연도</b><em>4자리</em></span>
              <input
                ref={yearRef}
                name="birthYear"
                type="text"
                inputMode="numeric"
                autoComplete="bday-year"
                placeholder="1955"
                maxLength={4}
                value={date.year}
                aria-invalid={Boolean(errors.birthDate)}
                aria-describedby={errors.birthDate ? "signup-birthdate-error" : "signup-birthdate-example"}
                onChange={(event) => updateDatePart("year", event.target.value)}
                onPaste={pasteDate}
                required
              />
            </label>
            <label>
              <span><b>월</b><em>2자리</em></span>
              <input
                ref={monthRef}
                name="birthMonth"
                type="text"
                inputMode="numeric"
                autoComplete="bday-month"
                placeholder="03"
                maxLength={2}
                value={date.month}
                aria-invalid={Boolean(errors.birthDate)}
                aria-describedby={errors.birthDate ? "signup-birthdate-error" : "signup-birthdate-example"}
                onChange={(event) => updateDatePart("month", event.target.value)}
                onBlur={() => normalizeShortDatePart("month")}
                onKeyDown={(event) => moveBackOnEmpty(event, yearRef)}
                onPaste={pasteDate}
                required
              />
            </label>
            <label>
              <span><b>일</b><em>2자리</em></span>
              <input
                ref={dayRef}
                name="birthDay"
                type="text"
                inputMode="numeric"
                autoComplete="bday-day"
                placeholder="12"
                maxLength={2}
                value={date.day}
                aria-invalid={Boolean(errors.birthDate)}
                aria-describedby={errors.birthDate ? "signup-birthdate-error" : "signup-birthdate-example"}
                onChange={(event) => updateDatePart("day", event.target.value)}
                onBlur={() => normalizeShortDatePart("day")}
                onKeyDown={(event) => moveBackOnEmpty(event, monthRef)}
                onPaste={pasteDate}
                required
              />
            </label>
          </div>
          <small id="signup-birthdate-example">예: 1955년 3월 12일</small>
          {errors.birthDate && <small className="member-field-error" id="signup-birthdate-error">{errors.birthDate}</small>}
        </fieldset>

        <label>
          <span>직분 또는 소속 부서 <em>선택</em></span>
          <input
            name="position"
            type="text"
            placeholder="예: 집사, 청년부, 새가족"
            maxLength={40}
            value={values.position}
            onChange={(event) => setValues((current) => ({ ...current, position: event.target.value }))}
          />
        </label>

        <label>
          <span>로그인 비밀번호 <b>*</b></span>
          <span className="member-password-input">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              inputMode="numeric"
              autoComplete="new-password"
              pattern="[0-9]{6}"
              maxLength={6}
              value={values.password}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "signup-password-error" : "signup-password-help"}
              onChange={(event) => {
                setValues((current) => ({
                  ...current,
                  password: event.target.value.replace(/\D/g, "").slice(0, 6),
                }));
                setErrors((current) => ({ ...current, password: undefined }));
              }}
              required
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)}>
              {showPassword ? "숨기기" : "보기"}
            </button>
          </span>
          <small id="signup-password-help">기억하기 쉬운 숫자 6자리를 입력해 주세요. 생년월일이나 전화번호는 피합니다.</small>
          {errors.password && <small className="member-field-error" id="signup-password-error">{errors.password}</small>}
        </label>

        <label>
          <span>비밀번호 다시 입력 <b>*</b></span>
          <span className="member-password-input">
            <input
              name="passwordConfirmation"
              type={showConfirmation ? "text" : "password"}
              inputMode="numeric"
              autoComplete="new-password"
              pattern="[0-9]{6}"
              maxLength={6}
              value={values.passwordConfirmation}
              aria-invalid={Boolean(errors.passwordConfirmation)}
              aria-describedby={errors.passwordConfirmation ? "signup-password-confirmation-error" : undefined}
              onChange={(event) => {
                setValues((current) => ({
                  ...current,
                  passwordConfirmation: event.target.value.replace(/\D/g, "").slice(0, 6),
                }));
                setErrors((current) => ({ ...current, passwordConfirmation: undefined }));
              }}
              required
            />
            <button type="button" onClick={() => setShowConfirmation((current) => !current)}>
              {showConfirmation ? "숨기기" : "보기"}
            </button>
          </span>
          {errors.passwordConfirmation && (
            <small className="member-field-error" id="signup-password-confirmation-error">
              {errors.passwordConfirmation}
            </small>
          )}
        </label>

        <label className="member-consent">
          <input
            name="consent"
            type="checkbox"
            checked={values.consent}
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? "signup-consent-error" : undefined}
            onChange={(event) => {
              setValues((current) => ({ ...current, consent: event.target.checked }));
              setErrors((current) => ({ ...current, consent: undefined }));
            }}
            required
          />
          <span>
            회원 확인과 홈페이지 이용을 위해 이름·연락처 등 가입 정보를 수집·이용하는
            것에 동의합니다. <b>*</b>
          </span>
        </label>
        {errors.consent && <small className="member-field-error" id="signup-consent-error">{errors.consent}</small>}

        <button type="submit" disabled={submitting}>
          {submitting ? "가입 신청 중…" : "회원가입 신청"}
        </button>
      </form>

      <AccessibleDialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        labelledBy="signup-guide-title"
        describedBy="signup-guide-description"
        className="member-guide-dialog"
      >
        <button
          className="member-dialog-close"
          type="button"
          onClick={() => setGuideOpen(false)}
          aria-label="가입 방법 안내 닫기"
        >
          ×
        </button>
        <span>MEMBER GUIDE</span>
        <h2 id="signup-guide-title">가입 방법을 알려드릴게요</h2>
        <p id="signup-guide-description">아래 순서대로 입력하면 됩니다.</p>
        <ol>
          <li><b>1</b><span>이름과 휴대전화 번호를 입력해 주세요.</span></li>
          <li><b>2</b><span>생년월일은 연도·월·일을 숫자로 입력해 주세요.</span></li>
          <li><b>3</b><span>로그인에 사용할 숫자 6자리 비밀번호를 만들어 주세요.</span></li>
          <li><b>4</b><span>신청 후 바로 로그인할 수 있으며, 회원 전용 콘텐츠는 관리자 승인 후 이용할 수 있습니다.</span></li>
        </ol>
        <button data-dialog-autofocus type="button" onClick={() => setGuideOpen(false)}>
          입력 시작하기
        </button>
      </AccessibleDialog>
    </>
  );
}
