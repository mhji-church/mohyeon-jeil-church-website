"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AdminMember, MemberStatus } from "../../../lib/members";
import type {
  MemberDuplicateCheck,
  MemberDuplicateField,
  MemberDuplicateGroup,
  MemberDuplicateSummary,
} from "../../../lib/member-duplicates";
import type { MemberMergePreview } from "../../../lib/member-merges";
import AdminPagination from "../AdminPagination";
import AdminSidebar from "../AdminSidebar";

type Props = {
  userName: string;
  userEmail: string;
  signOutPath: string;
  initialPendingMemberCount: number | null;
  canManageArchive: boolean;
};

const statusLabel: Record<MemberStatus, string> = {
  pending: "승인 대기",
  approved: "승인",
  suspended: "이용 중지",
};

type MemberFilter = MemberStatus | "all" | "duplicate";
type MemberPatch = Partial<Pick<AdminMember, "name" | "phone" | "birthDate" | "position" | "status">>;
type PendingDuplicateApproval = {
  member: AdminMember;
  patch: MemberPatch;
  check: MemberDuplicateCheck;
  source: "status" | "edit";
};
type MergeDraft = {
  representativeMemberId: string;
  name: string;
  phone: string;
  birthDate: string;
  position: string;
  confirmed: boolean;
};

function duplicateReasonLabel(fields: MemberDuplicateField[]) {
  if (fields.includes("phone") && fields.includes("birthDate")) return "휴대폰·생년월일 일치";
  return fields.includes("phone") ? "휴대폰 일치" : "생년월일 일치";
}

function DuplicateMatchList({ check }: { check: MemberDuplicateCheck }) {
  return (
    <div className="admin-duplicate-match-list">
      {check.matches.map((match) => (
        <article key={match.id}>
          <div>
            <strong>{match.name}</strong>
            <span>{match.username}</span>
          </div>
          <dl>
            <div><dt>상태</dt><dd>{statusLabel[match.status as MemberStatus] ?? match.status}</dd></div>
            <div><dt>가입일</dt><dd>{formatDate(match.createdAt)}</dd></div>
          </dl>
          <b>{duplicateReasonLabel(match.matchedFields)}</b>
        </article>
      ))}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return value.slice(0, 10).replaceAll("-", ".");
}

function hasDifferentValues(group: MemberDuplicateGroup, field: "name" | "phone" | "birthDate" | "position") {
  return new Set(group.accounts.map((account) => String(account[field] ?? "").trim())).size > 1;
}

export default function AdminMembers({ userName, userEmail, signOutPath, initialPendingMemberCount, canManageArchive }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<MemberDuplicateGroup[]>([]);
  const [duplicateSummary, setDuplicateSummary] = useState<MemberDuplicateSummary>({ groupCount: 0, accountCount: 0, additionalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const filterValue = searchParams.get("status");
  const filter: MemberFilter = ["pending", "approved", "suspended", "duplicate"].includes(filterValue ?? "") ? filterValue as MemberFilter : "all";
  const [editing, setEditing] = useState<AdminMember | null>(null);
  const [compareGroup, setCompareGroup] = useState<MemberDuplicateGroup | null>(null);
  const [mergePreview, setMergePreview] = useState<MemberMergePreview | null>(null);
  const [mergeDraft, setMergeDraft] = useState<MergeDraft | null>(null);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [duplicateApproval, setDuplicateApproval] = useState<PendingDuplicateApproval | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminMember | null>(null);
  const [confirmPasswordReset, setConfirmPasswordReset] = useState<AdminMember | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<{
    member: AdminMember;
    password: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState("");
  const listStartRef = useRef<HTMLElement>(null);
  const mergeDialogRef = useRef<HTMLElement>(null);
  const compareDialogRef = useRef<HTMLElement>(null);
  const dialogReturnFocusRef = useRef<HTMLElement | null>(null);

  const loadMembers = useCallback(async (preserveNotice = false) => {
    setLoading(true);
    if (!preserveNotice) setNotice("");
    try {
      const response = await fetch("/api/admin/members", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as {
        members?: AdminMember[];
        duplicateGroups?: MemberDuplicateGroup[];
        duplicateSummary?: MemberDuplicateSummary;
        error?: string;
      };
      if (!response.ok) {
        setNotice(data.error ?? "회원 목록을 불러오지 못했습니다.");
        return;
      }
      setMembers(data.members ?? []);
      setDuplicateGroups(data.duplicateGroups ?? []);
      setDuplicateSummary(data.duplicateSummary ?? { groupCount: 0, accountCount: 0, additionalCount: 0 });
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

  const visibleMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((member) => {
      if (filter === "duplicate" && !member.duplicateCheck) return false;
      if (filter !== "all" && filter !== "duplicate" && member.status !== filter) return false;
      if (!term) return true;
      return [member.name, member.username, member.phone, member.position]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [filter, members, search]);

  const visibleDuplicateGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return duplicateGroups;
    return duplicateGroups.filter((group) => group.accounts.some((account) =>
      [account.name, account.username, account.phone, account.birthDate, account.position ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term)));
  }, [duplicateGroups, search]);

  const requestedPage = Number(searchParams.get("page") ?? "1");
  const totalPages = Math.max(1, Math.ceil((filter === "duplicate" ? visibleDuplicateGroups.length : visibleMembers.length) / 10));
  const currentPage = Math.min(Math.max(Number.isInteger(requestedPage) ? requestedPage : 1, 1), totalPages);
  const paginatedMembers = visibleMembers.slice((currentPage - 1) * 10, currentPage * 10);
  const paginatedDuplicateGroups = visibleDuplicateGroups.slice((currentPage - 1) * 10, currentPage * 10);

  const changePage = useCallback((page: number, replace = false) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page"); else params.set("page", String(page));
    const url = `${pathname}${params.size ? `?${params}` : ""}`;
    if (replace) router.replace(url); else router.push(url);
    window.requestAnimationFrame(() => listStartRef.current?.scrollIntoView({ block: "start" }));
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!loading && requestedPage !== currentPage) changePage(currentPage, true);
  }, [changePage, currentPage, loading, requestedPage]);

  const changeFilter = (status: MemberFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "all") params.delete("status"); else params.set("status", status);
    params.delete("page");
    router.push(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  };

  const openDuplicateGroup = (groupId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", "duplicate");
    params.set("group", groupId);
    params.delete("page");
    setExpandedGroups((current) => new Set(current).add(groupId));
    router.push(`${pathname}?${params}`, { scroll: false });
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-duplicate-group-id="${CSS.escape(groupId)}"]`)?.scrollIntoView({ block: "start" });
    });
  };

  useEffect(() => {
    if (filter !== "duplicate") return;
    const groupId = searchParams.get("group");
    if (!groupId) return;
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-duplicate-group-id="${CSS.escape(groupId)}"]`)?.scrollIntoView({ block: "start" });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [filter, searchParams]);

  async function submitMemberUpdate(
    member: AdminMember,
    patch: MemberPatch,
    source: "status" | "edit",
    duplicateFingerprint?: string,
  ) {
    const response = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: member.id, member: patch, duplicateFingerprint }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      requiresDuplicateConfirmation?: boolean;
      duplicateCheck?: MemberDuplicateCheck;
    };
    if (data.requiresDuplicateConfirmation && data.duplicateCheck) {
      setDuplicateApproval({ member, patch, check: data.duplicateCheck, source });
      return false;
    }
    if (!response.ok) {
      setNotice(data.error ?? "회원 상태를 변경하지 못했습니다.");
      return false;
    }
    setDuplicateApproval(null);
    if (source === "edit") setEditing(null);
    const status = patch.status;
    setNotice(
      source === "edit"
        ? `${member.name} 회원 정보를 수정했습니다.`
        : status === "approved"
        ? `${member.name} 회원을 승인했습니다.`
        : status === "suspended"
          ? `${member.name} 회원의 이용을 중지했습니다.`
          : `${member.name} 회원을 승인 대기로 변경했습니다.`,
    );
    await loadMembers(true);
    window.dispatchEvent(new Event("admin-members-updated"));
    return true;
  }

  async function changeStatus(member: AdminMember, status: MemberStatus) {
    setApprovingId(member.id);
    try {
      await submitMemberUpdate(member, { status }, "status");
    } finally {
      setApprovingId("");
    }
  }

  async function saveMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    await submitMemberUpdate(editing, {
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      birthDate: String(form.get("birthDate") ?? ""),
      position: String(form.get("position") ?? ""),
      status: String(form.get("status") ?? editing.status) as MemberStatus,
    }, "edit");
    setSaving(false);
  }

  async function resetPassword(member: AdminMember) {
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
    await loadMembers(true);
    window.dispatchEvent(new Event("admin-members-updated"));
  }

  async function openMerge(groupId: string) {
    dialogReturnFocusRef.current = document.activeElement as HTMLElement | null;
    setMergeLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/members/merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "preview", groupId }),
      });
      const data = (await response.json().catch(() => ({}))) as { preview?: MemberMergePreview; error?: string };
      if (!response.ok || !data.preview) {
        setNotice(data.error ?? "병합 정보를 불러오지 못했습니다.");
        return;
      }
      setMergePreview(data.preview);
      setMergeDraft({
        representativeMemberId: data.preview.recommendedRepresentativeId,
        ...data.preview.recommendedProfile,
        confirmed: false,
      });
    } catch {
      setNotice("병합 정보를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.");
    } finally {
      setMergeLoading(false);
    }
  }

  function openComparison(group: MemberDuplicateGroup) {
    dialogReturnFocusRef.current = document.activeElement as HTMLElement | null;
    setCompareGroup(group);
  }

  const closeDialog = useCallback((kind: "merge" | "compare") => {
    if (kind === "merge") {
      setMergePreview(null);
      setMergeDraft(null);
    } else {
      setCompareGroup(null);
    }
    window.requestAnimationFrame(() => dialogReturnFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    const dialog = mergePreview ? mergeDialogRef.current : compareGroup ? compareDialogRef.current : null;
    if (!dialog) return;
    dialog.scrollTop = 0;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex='-1'])")];
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog(mergePreview ? "merge" : "compare");
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeDialog, compareGroup, mergePreview]);

  async function executeMerge() {
    if (!mergePreview || !mergeDraft || !mergeDraft.confirmed || mergePreview.blockedReasons.length) return;
    setMergeLoading(true);
    try {
      const response = await fetch("/api/admin/members/merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "merge",
          groupId: mergePreview.groupId,
          fingerprint: mergePreview.fingerprint,
          representativeMemberId: mergeDraft.representativeMemberId,
          profile: {
            name: mergeDraft.name,
            phone: mergeDraft.phone,
            birthDate: mergeDraft.birthDate,
            position: mergeDraft.position,
          },
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setNotice(data.error ?? "계정을 병합하지 못했습니다. 최신 정보를 다시 확인해 주세요.");
        setMergePreview(null);
        setMergeDraft(null);
        await loadMembers(true);
        return;
      }
      setNotice(`${mergePreview.accounts.length}개 계정을 하나의 회원으로 병합했습니다. 기존 로그인 아이디는 모두 보존됩니다.`);
      setMergePreview(null);
      setMergeDraft(null);
      await loadMembers(true);
      window.dispatchEvent(new Event("admin-members-updated"));
    } catch {
      setNotice("계정을 병합하지 못했습니다. 네트워크 연결을 확인해 주세요.");
    } finally {
      setMergeLoading(false);
    }
  }

  async function toggleAlias(member: AdminMember, username: string, enabled: boolean) {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/members/merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "alias",
          representativeMemberId: member.id,
          username,
          enabled,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setNotice(data.error ?? "로그인 아이디 상태를 변경하지 못했습니다.");
        return;
      }
      setNotice(`${username} 로그인 아이디를 ${enabled ? "활성화" : "비활성화"}했습니다.`);
      setEditing(null);
      await loadMembers(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-shell admin-members-shell">
      <AdminSidebar active="members" userName={userName} userEmail={userEmail} signOutPath={signOutPath} initialPendingMemberCount={initialPendingMemberCount} canManageWebsite canManageArchive={canManageArchive} />

      <section className="admin-workspace admin-members-workspace">
        <header className="admin-topbar">
          <div>
            <span>CHURCH MEMBERS</span>
            <h1>회원 관리</h1>
            <p>가입 신청을 확인하고 교인 계정의 승인과 이용 상태를 관리합니다.</p>
          </div>
          <div><button type="button" onClick={() => void loadMembers()}>목록 새로고침</button></div>
        </header>

        {notice && <div className="admin-notice" role="status">{notice}</div>}

        <section className="admin-list-panel admin-members-list-panel" ref={listStartRef}>
          <header className="admin-members-header">
            <div>
              <h2>전체 회원</h2>
              <span>총 {members.length}명{filter !== "all" || search ? ` · 표시 ${filter === "duplicate" ? visibleDuplicateGroups.length : visibleMembers.length}${filter === "duplicate" ? "그룹" : "명"}` : ""}</span>
              <button
                className="admin-duplicate-summary"
                type="button"
                aria-pressed={filter === "duplicate"}
                onClick={() => changeFilter("duplicate")}
              >
                중복 가입자 <strong>{duplicateSummary.groupCount}명</strong>
                <span>· 관련 계정 {duplicateSummary.accountCount}개 · 추가 계정 {duplicateSummary.additionalCount}개</span>
              </button>
            </div>
            <div className="admin-member-list-tools">
              <div className="admin-member-filters" role="group" aria-label="회원 상태 필터">
                {([['all', '전체'], ['pending', '승인 대기'], ['approved', '승인'], ['suspended', '이용 중지'], ['duplicate', `중복 가입 ${duplicateSummary.groupCount}`]] as const).map(([key, label]) => <button type="button" className={filter === key ? "is-active" : key === "duplicate" ? "is-duplicate-filter" : ""} aria-pressed={filter === key} onClick={() => changeFilter(key)} key={key}>{label}</button>)}
              </div>
              <label>
              <span className="sr-only">회원 검색</span>
              <input
                type="search"
                value={search}
                onChange={(event) => { setSearch(event.target.value); if (currentPage !== 1) changePage(1, true); }}
                placeholder="이름·아이디·연락처 검색"
              />
              </label>
            </div>
          </header>
          {loading ? (
            <div className="admin-empty">회원 목록을 불러오고 있습니다.</div>
          ) : (filter === "duplicate" ? visibleDuplicateGroups.length : visibleMembers.length) === 0 ? (
            <div className="admin-empty">
              <strong>조건에 맞는 회원이 없습니다.</strong>
            </div>
          ) : filter === "duplicate" ? (
            <div className="admin-duplicate-groups">
              {paginatedDuplicateGroups.map((group) => {
                const groupIndex = duplicateGroups.findIndex((item) => item.id === group.id) + 1;
                const uniqueNames = [...new Set(group.accounts.map((account) => account.name.trim()))];
                const expanded = expandedGroups.has(group.id) || searchParams.get("group") === group.id;
                return (
                  <section className="admin-duplicate-group" data-duplicate-group-id={group.id} key={group.id}>
                    <header>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={`duplicate-group-${groupIndex}`}
                        onClick={() => setExpandedGroups((current) => {
                          const next = new Set(current);
                          if (next.has(group.id)) next.delete(group.id); else next.add(group.id);
                          return next;
                        })}
                      >
                        <span>중복 {String(groupIndex).padStart(2, "0")}</span>
                        <strong>{uniqueNames[0]}{uniqueNames.length > 1 ? ` 외 다른 이름 ${uniqueNames.length - 1}개` : ""}</strong>
                        <small>관련 계정 {group.accounts.length}개 · 추가 계정 {group.accounts.length - 1}개</small>
                        {group.differentNames && <b>이름 상이</b>}
                        <i aria-hidden="true">{expanded ? "−" : "+"}</i>
                      </button>
                      <div>
                        <button type="button" onClick={() => openComparison(group)}>정보 비교</button>
                        <button className="admin-merge-open-button" type="button" onClick={() => void openMerge(group.id)}>계정 병합</button>
                      </div>
                    </header>
                    {expanded && (
                      <div className="admin-duplicate-group-accounts" id={`duplicate-group-${groupIndex}`}>
                        {group.accounts.map((account) => (
                          <article key={account.id}>
                            <div className="admin-duplicate-account-head">
                              <div><strong>{account.name}</strong><span>{account.username}</span></div>
                              <div>
                                <b>{account.isFirst ? "최초 가입" : "추가 가입"}</b>
                                <span className={`admin-status member-${account.status}`}>{statusLabel[account.status as MemberStatus] ?? account.status}</span>
                              </div>
                            </div>
                            <dl>
                              <div><dt>연락처</dt><dd>{account.phone || "-"}</dd></div>
                              <div><dt>생년월일</dt><dd>{account.birthDate || "-"}</dd></div>
                              <div><dt>직분·소속</dt><dd>{account.position || "-"}</dd></div>
                              <div><dt>가입일</dt><dd>{formatDate(account.createdAt)}</dd></div>
                              <div><dt>최근 로그인</dt><dd>{formatDate(account.lastLoginAt ?? null)}</dd></div>
                            </dl>
                            <p>{duplicateReasonLabel(account.matchedFields)}</p>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
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
                  {paginatedMembers.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="admin-member-name-line">
                          <strong>{member.name}</strong>
                          {member.duplicateCheck && (
                            <button
                              className="admin-duplicate-badge"
                              type="button"
                              onClick={() => member.duplicateGroupId && openDuplicateGroup(member.duplicateGroupId)}
                              aria-label={`${member.name} 중복 가입 상세 보기`}
                            >
                              중복 가입
                            </button>
                          )}
                        </div>
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
                            <button type="button" disabled={approvingId === member.id} onClick={() => void changeStatus(member, "approved")}>
                              {approvingId === member.id ? "확인 중…" : "승인"}
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
          <AdminPagination currentPage={currentPage} totalPages={totalPages} onPageChange={changePage} />
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
              {editing.duplicateCheck && (
                <section className="admin-editor-duplicate-panel">
                  <div>
                    <strong>중복 가입 가능성</strong>
                    <span>{duplicateReasonLabel(editing.duplicateCheck.matchedFields)}</span>
                  </div>
                  <button type="button" onClick={() => { if (editing.duplicateGroupId) { setEditing(null); openDuplicateGroup(editing.duplicateGroupId); } }}>중복 그룹 보기</button>
                </section>
              )}
              {editing.loginAliases.length > 1 && (
                <section className="admin-member-alias-panel">
                  <header>
                    <strong>로그인 아이디 {editing.loginAliases.length}개</strong>
                    <span>어느 아이디로 로그인해도 같은 대표 회원으로 연결됩니다.</span>
                  </header>
                  <ul>
                    {editing.loginAliases.map((alias) => (
                      <li key={alias.username}>
                        <span><strong>{alias.username}</strong>{alias.sourceMemberId === editing.id && <small>대표</small>}</span>
                        <button
                          type="button"
                          disabled={saving || alias.sourceMemberId === editing.id}
                          onClick={() => void toggleAlias(editing, alias.username, !alias.enabled)}
                        >
                          {alias.enabled ? "비활성화" : "활성화"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
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

      {compareGroup && (
        <div className="admin-confirm-backdrop" role="dialog" aria-modal="true" aria-label="중복 계정 정보 비교">
          <section className="admin-duplicate-dialog admin-duplicate-compare-dialog" ref={compareDialogRef}>
            <span>ACCOUNT COMPARISON</span>
            <h2>중복 계정 정보 비교</h2>
            <p>서로 다른 값은 ‘상이’로 표시합니다. 자동 판정은 참고 정보이며 최종 판단은 관리자가 합니다.</p>
            <div className="admin-duplicate-compare-table" role="table" aria-label="중복 계정 비교표">
              {compareGroup.accounts.map((account) => (
                <article role="row" key={account.id}>
                  <header><strong>{account.name}</strong><span>{account.username}</span></header>
                  {([['name', '이름'], ['phone', '연락처'], ['birthDate', '생년월일'], ['position', '직분·소속']] as const).map(([field, label]) => (
                    <div className={hasDifferentValues(compareGroup, field) ? "is-different" : ""} role="cell" key={field}>
                      <span>{label}{hasDifferentValues(compareGroup, field) && <b>상이</b>}</span>
                      <strong>{String(account[field] ?? "") || "-"}</strong>
                    </div>
                  ))}
                  <div role="cell"><span>가입 구분</span><strong>{account.isFirst ? "최초 가입" : "추가 가입"}</strong></div>
                  <div role="cell"><span>상태</span><strong>{statusLabel[account.status as MemberStatus] ?? account.status}</strong></div>
                </article>
              ))}
            </div>
            <div><button type="button" onClick={() => closeDialog("compare")}>닫기</button></div>
          </section>
        </div>
      )}

      {mergePreview && mergeDraft && (
        <div className="admin-confirm-backdrop admin-member-merge-backdrop" role="dialog" aria-modal="true" aria-label="회원 계정 병합 확인">
          <section className="admin-member-merge-dialog" ref={mergeDialogRef}>
            <header>
              <div><span>SAFE ACCOUNT MERGE</span><h2>회원 계정 병합 확인</h2></div>
              <button type="button" onClick={() => closeDialog("merge")} aria-label="병합 화면 닫기">×</button>
            </header>
            <p>원본 계정과 로그인 정보는 보존됩니다. 병합 즉시 기존 세션은 모두 종료되며 다시 로그인해야 합니다.</p>
            {mergePreview.blockedReasons.length > 0 && (
              <div className="admin-merge-blocked" role="alert">
                <strong>일반 병합을 진행할 수 없습니다.</strong>
                {mergePreview.blockedReasons.map((reason) => <span key={reason}>{reason}</span>)}
              </div>
            )}
            <section>
              <h3>병합 대상 계정 {mergePreview.accounts.length}개</h3>
              <div className="admin-merge-account-list">
                {mergePreview.accounts.map((account) => (
                  <article key={account.id}>
                    <div><strong>{account.name}</strong><span>{account.username}</span></div>
                    <p>{duplicateReasonLabel(account.matchedFields)} · {statusLabel[account.status as MemberStatus] ?? account.status}</p>
                    <small>사업장 신청 {account.relatedRecords.businessApplications}건 · 아카이브 권한 {account.relatedRecords.archiveAccess}건</small>
                  </article>
                ))}
              </div>
            </section>
            <section className="admin-merge-choices">
              <h3>병합 후 대표 정보</h3>
              <label><span>내부 대표 회원</span><select value={mergeDraft.representativeMemberId} onChange={(event) => setMergeDraft({ ...mergeDraft, representativeMemberId: event.target.value })}>{mergePreview.accounts.filter((account) => !mergePreview.accounts.some((item) => item.status === "approved") || account.status === "approved").map((account) => <option value={account.id} key={account.id}>{account.name} · {account.username}{account.id === mergePreview.recommendedRepresentativeId ? " (추천)" : ""}</option>)}</select></label>
              {([['name', '공개 이름'], ['phone', '연락처'], ['birthDate', '생년월일'], ['position', '직분·소속']] as const).map(([field, label]) => (
                <label key={field}><span>{label}</span><select value={mergeDraft[field]} onChange={(event) => setMergeDraft({ ...mergeDraft, [field]: event.target.value })}>{[...new Set(mergePreview.accounts.map((account) => String(account[field] ?? "").trim()))].map((value) => <option value={value} key={`${field}-${value}`}>{value || "미입력"}</option>)}</select></label>
              ))}
            </section>
            <section className="admin-merge-result-summary">
              <h3>병합 전후</h3>
              <dl>
                <div><dt>로그인 아이디</dt><dd>{mergePreview.accounts.length}개 모두 유지</dd></div>
                <div><dt>비밀번호</dt><dd>각 아이디의 기존 비밀번호 유지, 다음 변경 시 전체 통일</dd></div>
                <div><dt>회원 상태·권한</dt><dd>선택한 대표 회원 기준 · 권한 자동 합산 없음</dd></div>
                <div><dt>관련 기록</dt><dd>사업장 신청 {mergePreview.recordSummary.businessApplications}건 추적 · 기존 아카이브 권한 원본 보존</dd></div>
                <div><dt>세션</dt><dd>모든 기존 로그인 세션 즉시 폐기</dd></div>
              </dl>
            </section>
            <label className="admin-merge-confirm-check"><input type="checkbox" checked={mergeDraft.confirmed} onChange={(event) => setMergeDraft({ ...mergeDraft, confirmed: event.target.checked })} /><span>대표 정보와 로그인 아이디, 상태·권한 유지 기준을 확인했습니다.</span></label>
            <footer>
              <button type="button" disabled={mergeLoading} onClick={() => closeDialog("merge")}>취소</button>
              <button className="admin-confirm-merge-button" type="button" disabled={mergeLoading || !mergeDraft.confirmed || mergePreview.blockedReasons.length > 0} onClick={() => void executeMerge()}>{mergeLoading ? "병합 처리 중…" : "확인 후 계정 병합"}</button>
            </footer>
          </section>
        </div>
      )}

      {duplicateApproval && (
        <div className="admin-confirm-backdrop admin-duplicate-approval-backdrop" role="alertdialog" aria-modal="true" aria-label="중복 가입 승인 확인">
          <section className="admin-duplicate-dialog">
            <span>APPROVAL REVIEW</span>
            <h2>중복 가능성을 확인하고 승인할까요?</h2>
            <p>‘{duplicateApproval.member.name}’ 회원은 아래 기존 회원과 정보가 일치합니다. 계정 병합이나 삭제는 수행되지 않습니다.</p>
            <DuplicateMatchList check={duplicateApproval.check} />
            <div>
              <button type="button" disabled={approvingId === duplicateApproval.member.id || saving} onClick={() => setDuplicateApproval(null)}>취소</button>
              <button
                className="admin-confirm-duplicate-button"
                type="button"
                disabled={approvingId === duplicateApproval.member.id || saving}
                onClick={async () => {
                  const pending = duplicateApproval;
                  if (pending.source === "edit") setSaving(true); else setApprovingId(pending.member.id);
                  try {
                    await submitMemberUpdate(
                      pending.member,
                      pending.patch,
                      pending.source,
                      pending.check.fingerprint,
                    );
                  } finally {
                    setSaving(false);
                    setApprovingId("");
                  }
                }}
              >
                {approvingId === duplicateApproval.member.id || saving ? "최신 정보 확인 중…" : "확인 후 승인"}
              </button>
            </div>
          </section>
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
