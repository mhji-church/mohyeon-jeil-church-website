"use client";

import { FormEvent, useState } from "react";
import type { Member } from "../../lib/members";
import { formatMobilePhone } from "../../lib/phone";

type ProfileMember = Pick<
  Member,
  "username" | "name" | "phone" | "birthDate" | "position" | "createdAt"
>;

export default function MemberProfileForm({ member }: { member: ProfileMember }) {
  const [profileNotice, setProfileNotice] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [phone, setPhone] = useState(member.phone);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileNotice("");
    setProfileError("");
    setSavingProfile(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/members/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "profile",
          name: String(form.get("name") ?? ""),
          phone,
          birthDate: String(form.get("birthDate") ?? ""),
          position: String(form.get("position") ?? ""),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setProfileError(data.error ?? "회원 정보를 변경하지 못했습니다.");
        return;
      }
      setProfileNotice("회원 정보가 저장됐습니다.");
      window.dispatchEvent(new Event("member-profile-updated"));
    } catch {
      setProfileError("회원 정보를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPasswordNotice("");
    setPasswordError("");
    const form = new FormData(formElement);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password !== confirmation) {
      setPasswordError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch("/api/members/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "password",
          currentPassword,
          password,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setPasswordError(data.error ?? "비밀번호를 변경하지 못했습니다.");
        return;
      }
      formElement.reset();
      setPasswordNotice("비밀번호가 변경됐습니다.");
    } catch {
      setPasswordError("비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="member-profile-grid">
      <section className="member-profile-card">
        <header>
          <div>
            <span>PERSONAL INFORMATION</span>
            <h2>개인정보 변경</h2>
          </div>
          <small>가입일 {member.createdAt.slice(0, 10)}</small>
        </header>

        <form className="member-profile-form" onSubmit={saveProfile}>
          <div className="member-profile-fields">
            <label>
              <span>이름</span>
              <input
                name="name"
                type="text"
                minLength={2}
                maxLength={30}
                defaultValue={member.name}
                required
              />
            </label>
            <label>
              <span>아이디</span>
              <input type="text" value={member.username} disabled />
              <small>아이디는 변경할 수 없습니다.</small>
            </label>
            <label>
              <span>휴대전화</span>
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(event) => setPhone(formatMobilePhone(event.target.value))}
                placeholder="010-0000-0000"
                maxLength={13}
                required
              />
            </label>
            <label>
              <span>생년월일</span>
              <input name="birthDate" type="date" defaultValue={member.birthDate} />
            </label>
            <label className="member-profile-position">
              <span>직분 또는 소속 부서</span>
              <input
                name="position"
                type="text"
                maxLength={40}
                defaultValue={member.position}
                placeholder="예: 집사, 청년부"
              />
            </label>
          </div>

          {profileError && <p className="member-form-error" role="alert">{profileError}</p>}
          {profileNotice && <p className="member-form-success" role="status">{profileNotice}</p>}

          <div className="member-profile-actions">
            <a href="/api/members/session?return_to=/" className="member-profile-logout">
              로그아웃
            </a>
            <button type="submit" disabled={savingProfile}>
              {savingProfile ? "저장 중…" : "변경사항 저장"}
            </button>
          </div>
        </form>
      </section>

      <section className="member-profile-card member-password-card">
        <header>
          <div>
            <span>ACCOUNT SECURITY</span>
            <h2>비밀번호 변경</h2>
          </div>
        </header>

        <form className="member-profile-form" onSubmit={savePassword}>
          <label>
            <span>현재 비밀번호</span>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            <span>새 비밀번호</span>
            <input
              name="password"
              type="password"
              minLength={6}
              maxLength={72}
              autoComplete="new-password"
              required
            />
            <small>6~72자로 입력해 주세요.</small>
          </label>
          <label>
            <span>새 비밀번호 확인</span>
            <input
              name="confirmation"
              type="password"
              minLength={6}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          </label>

          {passwordError && <p className="member-form-error" role="alert">{passwordError}</p>}
          {passwordNotice && <p className="member-form-success" role="status">{passwordNotice}</p>}

          <div className="member-profile-actions is-single">
            <button type="submit" disabled={savingPassword}>
              {savingPassword ? "변경 중…" : "비밀번호 변경"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
