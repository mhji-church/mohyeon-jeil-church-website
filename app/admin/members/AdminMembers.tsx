"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Member, MemberStatus } from "../../../lib/members";

type Props = {
  userName: string;
  userEmail: string;
  signOutPath: string;
};

const statusLabel: Record<MemberStatus, string> = {
  pending: "승인 대기",
  approved: "승인",
  suspended: "이용 중지",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return value.slice(0, 10).replaceAll("-", ".");
}

export default function AdminMembers({ userName, userEmail, signOutPath }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MemberStatus | "all">("all");
  const [editing, setEditing] = useState<Member | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Member | null>(null);
  const [confirmPasswordReset, setConfirmPasswordReset] = useState<Member | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<{
    member: Member;
    password: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState("");

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/members", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as {
        members?: Member[];
        error?: string;
      };
      if (!response.ok) {
        setNotice(data.error ?? "회원 목록을 불러오지 못했습니다.");
        return;
      }
      setMembers(data.members ?? []);
    } catch {
      setNotice("회원 목록을 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMembers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMembers]);

  const counts = useMemo(
    () => ({
      all: members.length,
      pending: members.filter((member) => member.status === "pending").length,
      approved: members.filter((member) => member.status === "approved").length,
      suspended: members.filter((member) => member.status === "suspended").length,
    }),
    [members],
  );

  const visibleMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((member) => {
      if (filter !== "all" && member.status !== filter) return false;
      if (!term) return true;
      return [member.name, member.username, member.phone, member.position]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [filter, members, search]);

  async function changeStatus(member: Member, status: MemberStatus) {
    const response = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: member.id, member: { status } }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error ?? "회원 상태를 변경하지 못했습니다.");
      return;
    }
    setNotice(
      status === "approved"
        ? `${member.name} 회원을 승인했습니다.`
        : status === "suspended"
          ? `${member.name} 회원의 이용을 중지했습니다.`
          : `${member.name} 회원을 승인 대기로 변경했습니다.`,
    );
    await loadMembers();
  }

  async function saveMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        member: {
          name: String(form.get("name") ?? ""),
          phone: String(form.get("phone") ?? ""),
          birthDate: String(form.get("birthDate") ?? ""),
          position: String(form.get("position") ?? ""),
          status: String(form.get("status") ?? editing.status),
        },
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error ?? "회원 정보를 수정하지 못했습니다.");
    } else {
      setNotice(`${editing.name} 회원 정보를 수정했습니다.`);
      setEditing(null);
      await loadMembers();
    }
    setSaving(false);
  }

  async function resetPassword(member: Member) {
    setResettingPassword(true);
    setNotice("");
    setPasswordResetError("");
    try {
      const response = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: member.id, action: "reset-password" }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        temporaryPassword?: string;
      };
      if (!response.ok || !data.temporaryPassword) {
        setPasswordResetError(data.error ?? "임시 비밀번호를 발급하지 못했습니다.");
        return;
      }
      setConfirmPasswordReset(null);
      setPasswordResetError("");
      setTemporaryPassword({ member, password: data.temporaryPassword });
    } catch {
      setPasswordResetError(
        "임시 비밀번호를 발급하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setResettingPassword(false);
    }
  }

  async function deleteSelectedMember() {
    if (!confirmDelete) return;
    const response = await fetch(
      `/api/admin/members?id=${encodeURIComponent(confirmDelete.id)}`,
      { method: "DELETE" },
    );
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error ?? "회원을 삭제하지 못했습니다.");
      return;
    }
    setNotice(`${confirmDelete.name} 회원을 삭제했습니다.`);
    setConfirmDelete(null);
    await loadMembers();
  }

  return (
    <main className="admin-shell admin-members-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/" aria-label="모현제일교회 홈페이지">
          <img src="/assets/logo-horizontal.png" alt="모현제일교회" />
          <span>WEBSITE ADMIN</span>
        </Link>
        <nav aria-label="관리 메뉴">
          <a href="/admin?section=bulletin"><i>01</i><span>주보 관리</span></a>
          <a href="/admin?section=news"><i>02</i><span>교회소식 관리</span></a>
          <a href="/admin?section=gallery"><i>03</i><span>갤러리 관리</span></a>
          <a href="/admin?section=business"><i>04</i><span>성도사업장 관리</span></a>
          <a className="is-active" href="/admin/members">
            <i>05</i><span>회원 관리</span><b>{counts.all}</b>
          </a>
        </nav>
        <div className="admin-account">
          <span>{userName}</span>
          <small>{userEmail}</small>
          <a href={signOutPath}>로그아웃</a>
        </div>
      </aside>

      <section className="admin-workspace admin-members-workspace">
        <header className="admin-topbar">
          <div>
            <span>CHURCH MEMBERS</span>
            <h1>회원 관리</h1>
            <p>가입 신청을 확인하고 교인 계정의 승인과 이용 상태를 관리합니다.</p>
          </div>
          <div>
            <a href="/member/signup" target="_blank">회원가입 페이지 보기</a>
            <button type="button" onClick={() => void loadMembers()}>목록 새로고침</button>
          </div>
        </header>

        <div className="admin-stats admin-member-stats">
          {([
            ["all", "전체 회원"],
            ["pending", "승인 대기"],
            ["approved", "승인 회원"],
            ["suspended", "이용 중지"],
          ] as const).map(([key, label]) => (
            <button
              type="button"
              className={filter === key ? "is-active" : ""}
              onClick={() => setFilter(key)}
              key={key}
            >
              <span>{label}</span>
              <strong>{counts[key]}</strong>
              <small>등록 계정</small>
            </button>
          ))}
        </div>

        {notice && <div className="admin-notice" role="status">{notice}</div>}

        <section className="admin-list-panel">
          <header className="admin-members-header">
            <div>
              <h2>교인 회원 목록</h2>
              <span>총 {visibleMembers.length}명</span>
            </div>
            <label>
              <span className="sr-only">회원 검색</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="이름·아이디·연락처 검색"
              />
            </label>
          </header>
          {loading ? (
            <div className="admin-empty">회원 목록을 불러오고 있습니다.</div>
          ) : visibleMembers.length === 0 ? (
            <div className="admin-empty">
              <strong>조건에 맞는 회원이 없습니다.</strong>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-members-table">
                <thead>
                  <tr>
                    <th>이름·아이디</th>
                    <th>연락처</th>
                    <th>직분·소속</th>
                    <th>가입일</th>
                    <th>최근 로그인</th>
                    <th>상태</th>
                    <th><span className="sr-only">관리</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <strong>{member.name}</strong>
                        <small>{member.username}</small>
                      </td>
                      <td>{member.phone}</td>
                      <td>{member.position || "-"}</td>
                      <td>{formatDate(member.createdAt)}</td>
                      <td>{formatDate(member.lastLoginAt)}</td>
                      <td>
                        <span className={`admin-status member-${member.status}`}>
                          {statusLabel[member.status]}
                        </span>
                      </td>
                      <td>
                        <div className="admin-row-actions member-row-actions">
                          {member.status !== "approved" && (
                            <button type="button" onClick={() => void changeStatus(member, "approved")}>
                              승인
                            </button>
                          )}
                          {member.status === "approved" && (
                            <button type="button" onClick={() => void changeStatus(member, "suspended")}>
                              중지
                            </button>
                          )}
                          <button type="button" onClick={() => setEditing(member)}>정보</button>
                          <button
                            className="admin-temporary-password-button"
                            type="button"
                            onClick={() => {
                              setPasswordResetError("");
                              setConfirmPasswordReset(member);
                            }}
                          >
                            임시 비밀번호 발급
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(member)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {editing && (
        <div className="admin-editor-backdrop" role="dialog" aria-modal="true">
          <form className="admin-editor admin-member-editor" onSubmit={saveMember}>
            <header>
              <div>
                <span>EDIT MEMBER</span>
                <h2>{editing.name} 회원 정보</h2>
              </div>
              <button type="button" onClick={() => setEditing(null)} aria-label="닫기">×</button>
            </header>
            <div className="admin-editor-body">
              <div className="admin-field-row">
                <label>
                  <span>이름</span>
                  <input name="name" type="text" defaultValue={editing.name} required />
                </label>
                <label>
                  <span>아이디</span>
                  <input type="text" value={editing.username} disabled />
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  <span>휴대전화</span>
                  <input name="phone" type="tel" defaultValue={editing.phone} required />
                </label>
                <label>
                  <span>생년월일</span>
                  <input name="birthDate" type="date" defaultValue={editing.birthDate} />
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  <span>직분 또는 소속 부서</span>
                  <input name="position" type="text" defaultValue={editing.position} />
                </label>
                <label>
                  <span>계정 상태</span>
                  <select name="status" defaultValue={editing.status}>
                    <option value="pending">승인 대기</option>
                    <option value="approved">승인</option>
                    <option value="suspended">이용 중지</option>
                  </select>
                </label>
              </div>
            </div>
            <footer>
              <button
                className="admin-password-reset-button"
                type="button"
                onClick={() => {
                  setPasswordResetError("");
                  setConfirmPasswordReset(editing);
                }}
                disabled={saving || resettingPassword}
              >
                임시 비밀번호 발급
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "저장 중…" : "회원 정보 저장"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {temporaryPassword && (
        <div className="admin-confirm-backdrop" role="dialog" aria-modal="true">
          <section className="admin-temp-password">
            <span>TEMPORARY PASSWORD</span>
            <h2>임시 비밀번호가 발급됐습니다</h2>
            <p>
              {temporaryPassword.member.name} 회원에게 아래 비밀번호를 안전하게
              전달해 주세요. 다음 로그인 때 새 비밀번호로 변경해야 합니다.
            </p>
            <strong>{temporaryPassword.password}</strong>
            <button type="button" onClick={() => setTemporaryPassword(null)}>확인</button>
          </section>
        </div>
      )}

      {confirmPasswordReset && (
        <div className="admin-confirm-backdrop" role="alertdialog" aria-modal="true">
          <section>
            <span>RESET PASSWORD</span>
            <h2>임시 비밀번호를 발급할까요?</h2>
            <p>
              ‘{confirmPasswordReset.name}({confirmPasswordReset.username})’ 회원의 기존
              비밀번호는 즉시 사용할 수 없게 됩니다. 새로 발급된 임시 비밀번호로
              로그인하면 비밀번호를 다시 설정해야 합니다.
            </p>
            {passwordResetError && (
              <p className="admin-dialog-error" role="alert">{passwordResetError}</p>
            )}
            <div>
              <button
                type="button"
                onClick={() => {
                  setConfirmPasswordReset(null);
                  setPasswordResetError("");
                }}
                disabled={resettingPassword}
              >
                취소
              </button>
              <button
                className="admin-confirm-reset-button"
                type="button"
                onClick={() => void resetPassword(confirmPasswordReset)}
                disabled={resettingPassword}
              >
                {resettingPassword ? "발급 중…" : "발급"}
              </button>
            </div>
          </section>
        </div>
      )}

      {confirmDelete && (
        <div className="admin-confirm-backdrop" role="alertdialog" aria-modal="true">
          <section>
            <span>DELETE MEMBER</span>
            <h2>회원 계정을 삭제할까요?</h2>
            <p>
              ‘{confirmDelete.name}({confirmDelete.username})’ 계정은 삭제 후
              복구할 수 없습니다.
            </p>
            <div>
              <button type="button" onClick={() => setConfirmDelete(null)}>취소</button>
              <button type="button" onClick={() => void deleteSelectedMember()}>삭제</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
