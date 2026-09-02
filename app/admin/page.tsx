import Link from "next/link";
import { requireAdminPage } from "../admin-auth";
import { getAdminContentSummary, type ContentPost, type ContentType } from "../../lib/content";
import { getAdminMemberSummary } from "../../lib/members";
import { getKoreaDate } from "../../lib/korea-date";
import AdminSidebar from "./AdminSidebar";
import { logServerError } from "../../lib/api-response";

export const dynamic = "force-dynamic";

const contentLabels: Record<ContentType, string> = {
  bulletin: "주보", news: "교회소식", gallery: "갤러리", business: "성도사업장",
};

const quickCreateItems = [
  { type: "bulletin", label: "새 주보 등록", description: "이번 주 주보 이미지를 등록합니다.", icon: "＋" },
  { type: "news", label: "교회소식 작성", description: "새로운 안내와 소식을 작성합니다.", icon: "＋" },
  { type: "gallery", label: "갤러리 등록", description: "행사 사진과 앨범을 등록합니다.", icon: "＋" },
  { type: "business", label: "성도사업장 등록", description: "새 사업장 정보를 등록합니다.", icon: "＋" },
] as const;

function formatAdminDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "날짜 정보 없음";
  if (/[ T]\d{2}:\d{2}/.test(trimmed)) {
    const isoValue = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
    const parsed = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(isoValue) ? isoValue : `${isoValue}Z`);
    if (!Number.isNaN(parsed.getTime())) return getKoreaDate(parsed);
  }
  return trimmed.slice(0, 10).replaceAll("-", ".").replaceAll("/", ".");
}

function getPublishDate(post: ContentPost) {
  const value = post.date.trim() || post.createdAt.trim();
  const dateTime = post.date.trim()
    ? value.slice(0, 10).replaceAll(".", "-").replaceAll("/", "-")
    : value;
  return { dateTime, formatted: formatAdminDate(value) };
}

export default async function AdminHomePage() {
  const { user } = await requireAdminPage();
  const month = getKoreaDate().slice(0, 7).replaceAll(".", "-");
  let memberSummary: Awaited<ReturnType<typeof getAdminMemberSummary>> | null = null;
  let contentSummary: Awaited<ReturnType<typeof getAdminContentSummary>> | null = null;
  try {
    memberSummary = await getAdminMemberSummary();
  } catch (error) {
    logServerError("admin.home.member_summary", error);
  }
  try {
    contentSummary = await getAdminContentSummary(month);
  } catch (error) {
    logServerError("admin.home.content_summary", error);
  }
  const pendingCount = memberSummary?.pendingCount ?? null;
  const approvedCount = memberSummary?.approvedCount ?? null;
  const recentPosts: ContentPost[] = contentSummary?.recentPosts ?? [];

  return (
    <main className="admin-shell admin-members-shell">
      <AdminSidebar active="home" userName={user.fullName ?? "홈페이지 관리자"} userEmail={user.email} signOutPath="/api/admin/session?return_to=/" initialPendingMemberCount={pendingCount} />
      <section className="admin-workspace admin-members-workspace admin-home-workspace">
        <section className="admin-home-section" aria-labelledby="admin-status-title">
          <header className="admin-section-heading"><div><span>STATUS</span><h2 id="admin-status-title">운영 현황</h2></div></header>
          <div className="admin-home-status-grid">
            <Link href="/admin/members?status=pending" aria-label={`승인 대기 회원 ${pendingCount ?? "확인 필요"}, 회원 확인하기`}>
              <i aria-hidden="true">!</i><span>승인 대기 회원</span><strong>{pendingCount ?? "—"}<em>{pendingCount === null ? "" : "명"}</em></strong><small><b>{pendingCount === null ? "데이터 연결 확인 필요" : "회원 확인하기"}<i aria-hidden="true">→</i></b></small>
            </Link>
            <Link href="/admin/content?section=bulletin" aria-label={`이번 달 게시 콘텐츠 ${contentSummary?.monthlyCount ?? "확인 필요"}, 게시 콘텐츠 관리하기`}>
              <i aria-hidden="true">＋</i><span>이번 달 게시 콘텐츠</span><strong>{contentSummary?.monthlyCount ?? "—"}<em>{contentSummary ? "건" : ""}</em></strong><small>{contentSummary && <span>{month.replace("-", ".")} 게시일 기준</span>}<b>{contentSummary ? "게시 콘텐츠 관리하기" : "데이터 연결 확인 필요"}<i aria-hidden="true">→</i></b></small>
            </Link>
            <Link href="/admin/members?status=approved" aria-label={`전체 승인 회원 ${approvedCount ?? "확인 필요"}, 회원 목록 보기`}>
              <i aria-hidden="true">✓</i><span>전체 승인 회원</span><strong>{approvedCount ?? "—"}<em>{approvedCount === null ? "" : "명"}</em></strong><small><b>{approvedCount === null ? "데이터 연결 확인 필요" : "회원 목록 보기"}<i aria-hidden="true">→</i></b></small>
            </Link>
          </div>
        </section>

        <div className="admin-home-detail-grid">
          <section className="admin-home-section admin-home-recent-section" aria-labelledby="admin-recent-title">
            <header className="admin-section-heading"><div><span>RECENT CONTENT</span><h2 id="admin-recent-title">최근 콘텐츠</h2></div></header>
            <div className="admin-home-recent-list">
              {contentSummary === null ? <div className="admin-empty"><strong>최근 콘텐츠를 불러오지 못했습니다.</strong></div> : recentPosts.length === 0 ? <div className="admin-empty"><strong>등록된 콘텐츠가 없습니다.</strong></div> : recentPosts.map((post) => {
                const publishDate = getPublishDate(post);
                return (
                  <article key={post.id}>
                    <span>{contentLabels[post.type]}</span>
                    <strong title={post.title}>{post.title}</strong>
                    <time dateTime={publishDate.dateTime}>게시 {publishDate.formatted}</time>
                    <Link href={`/admin/content?section=${post.type}&edit=${encodeURIComponent(post.id)}`} aria-label={`${post.title} 수정`}>수정</Link>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="admin-home-section admin-home-quick-section" aria-labelledby="admin-quick-title">
            <header className="admin-section-heading"><div><span>QUICK CREATE</span><h2 id="admin-quick-title">빠른 등록</h2></div></header>
            <div className="admin-home-quick-grid">
              {quickCreateItems.map((item) => (
                <Link href={`/admin/content?section=${item.type}&new=1`} key={item.type}>
                  <i aria-hidden="true">{item.icon}</i>
                  <span>{contentLabels[item.type]}</span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                  <b aria-hidden="true">→</b>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
