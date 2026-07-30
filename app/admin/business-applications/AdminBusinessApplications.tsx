"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BusinessApplication,
  BusinessApplicationStatus,
} from "../../../lib/business-applications";

type Props = {
  userName: string;
  userEmail: string;
  signOutPath: string;
};

const statusLabels: Record<BusinessApplicationStatus, string> = {
  pending: "접수",
  reviewed: "검토 중",
  completed: "처리 완료",
};

function displayDate(value: string) {
  return value ? value.slice(0, 10).replaceAll("-", ".") : "-";
}

export default function AdminBusinessApplications({
  userName,
  userEmail,
  signOutPath,
}: Props) {
  const [applications, setApplications] = useState<BusinessApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<BusinessApplication | null>(null);
  const [saving, setSaving] = useState(false);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/business-applications", {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        applications?: BusinessApplication[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "신청 목록을 불러오지 못했습니다.");
      setApplications(data.applications ?? []);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "신청 목록을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadApplications(), 0);
    return () => window.clearTimeout(timer);
  }, [loadApplications]);

  const counts = useMemo(
    () => ({
      all: applications.length,
      pending: applications.filter((item) => item.status === "pending").length,
      reviewed: applications.filter((item) => item.status === "reviewed").length,
      completed: applications.filter((item) => item.status === "completed").length,
    }),
    [applications],
  );

  async function saveApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/business-applications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: selected.id,
        status: String(form.get("status") ?? selected.status),
        adminNote: String(form.get("adminNote") ?? ""),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      createdDraft?: boolean;
    };
    if (!response.ok) {
      setNotice(data.error ?? "신청 상태를 변경하지 못했습니다.");
    } else {
      setNotice(
        data.createdDraft
          ? `${selected.businessName}을 성도사업장 관리에 임시저장으로 등록했습니다.`
          : `${selected.businessName} 신청 정보를 수정했습니다.`,
      );
      setSelected(null);
      await loadApplications();
    }
    setSaving(false);
  }

  async function removeApplication(application: BusinessApplication) {
    if (!window.confirm(`${application.businessName} 신청 내역을 삭제할까요?`)) return;
    const response = await fetch(
      `/api/admin/business-applications?id=${encodeURIComponent(application.id)}`,
      { method: "DELETE" },
    );
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setNotice(data.error ?? "신청 내역을 삭제하지 못했습니다.");
      return;
    }
    setNotice(`${application.businessName} 신청 내역을 삭제했습니다.`);
    await loadApplications();
  }

  return (
    <main className="admin-shell">
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
          <a href="/admin/members"><i>05</i><span>회원 관리</span></a>
          <a className="is-active" href="/admin/business-applications">
            <i>06</i><span>사업장 신청 관리</span><b>{counts.pending}</b>
          </a>
        </nav>
        <div className="admin-account">
          <span>{userName}</span>
          <small>{userEmail}</small>
          <a href={signOutPath}>로그아웃</a>
        </div>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <span>BUSINESS APPLICATIONS</span>
            <h1>사업장 신청 관리</h1>
            <p>성도들이 보낸 사업장 등록 신청을 확인하고 처리 상태를 관리합니다.</p>
          </div>
          <div>
            <a href="/business/apply" target="_blank">신청 페이지 보기</a>
            <button type="button" onClick={() => void loadApplications()}>목록 새로고침</button>
          </div>
        </header>

        <div className="admin-stats admin-member-stats">
          {([
            ["all", "전체 신청"],
            ["pending", "접수"],
            ["reviewed", "검토 중"],
            ["completed", "처리 완료"],
          ] as const).map(([key, label]) => (
            <button type="button" key={key}>
              <span>{label}</span>
              <strong>{counts[key]}</strong>
              <small>신청 건수</small>
            </button>
          ))}
        </div>

        {notice && <div className="admin-notice" role="status">{notice}</div>}

        <section className="admin-list-panel">
          <header>
            <div>
              <h2>사업장 등록 신청</h2>
              <span>총 {applications.length}건</span>
            </div>
          </header>
          {loading ? (
            <div className="admin-empty">신청 목록을 불러오고 있습니다.</div>
          ) : applications.length === 0 ? (
            <div className="admin-empty"><strong>접수된 신청이 없습니다.</strong></div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-business-application-table">
                <thead>
                  <tr>
                    <th>사업장</th>
                    <th>업종</th>
                    <th>신청자</th>
                    <th>연락처</th>
                    <th>접수일</th>
                    <th>상태</th>
                    <th><span className="sr-only">관리</span></th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => (
                    <tr key={application.id}>
                      <td>
                        <strong>{application.businessName}</strong>
                        <small>{application.address}</small>
                      </td>
                      <td>{application.category}</td>
                      <td>{application.applicantName}</td>
                      <td>{application.applicantPhone}</td>
                      <td>{displayDate(application.createdAt)}</td>
                      <td>
                        <span className={`admin-status application-${application.status}`}>
                          {statusLabels[application.status]}
                        </span>
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          <button type="button" onClick={() => setSelected(application)}>확인</button>
                          <button type="button" onClick={() => void removeApplication(application)}>삭제</button>
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

      {selected && (
        <div className="admin-editor-backdrop" role="dialog" aria-modal="true">
          <form className="admin-editor" onSubmit={saveApplication}>
            <header>
              <div>
                <span>APPLICATION DETAIL</span>
                <h2>{selected.businessName}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="닫기">×</button>
            </header>
            <div className="admin-editor-body">
              <dl className="admin-application-detail">
                <div><dt>업종</dt><dd>{selected.category}</dd></div>
                <div><dt>대표자·성도명</dt><dd>{selected.ownerName}</dd></div>
                <div><dt>신청자</dt><dd>{selected.applicantName} · {selected.applicantPhone}</dd></div>
                <div><dt>사업장 연락처</dt><dd>{selected.businessPhone || "-"}</dd></div>
                <div><dt>주소</dt><dd>{selected.address}</dd></div>
                <div><dt>홈페이지·SNS</dt><dd>{selected.website || "-"}</dd></div>
                <div><dt>사업장 소개</dt><dd>{selected.description}</dd></div>
                {selected.imageUrl && (
                  <div className="admin-application-image">
                    <dt>대표 이미지</dt>
                    <dd><img src={selected.imageUrl} alt={`${selected.businessName} 대표 이미지`} /></dd>
                  </div>
                )}
              </dl>
              <label>
                <span>처리 상태</span>
                <select name="status" defaultValue={selected.status}>
                  <option value="pending">접수</option>
                  <option value="reviewed">검토 중</option>
                  <option value="completed">처리 완료</option>
                </select>
              </label>
              <label>
                <span>관리자 메모</span>
                <textarea name="adminNote" rows={4} defaultValue={selected.adminNote} />
              </label>
            </div>
            <footer>
              <button className="admin-editor-cancel" type="button" onClick={() => setSelected(null)}>
                취소
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "저장 중…" : "상태 저장"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}
