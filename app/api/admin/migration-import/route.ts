import { requireAdminApi } from "../../../admin-auth";
import { ensureNetlifySchema, getNetlifyDb } from "../../../../lib/netlify-db";

type RecordValue = Record<string, unknown>;

function string(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function integer(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function records(value: unknown, maximum: number) {
  if (!Array.isArray(value) || value.length > maximum) return null;
  return value.every((item) => item && typeof item === "object")
    ? (value as RecordValue[])
    : null;
}

export async function POST(request: Request) {
  const user = await requireAdminApi();
  if (!user) {
    return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as RecordValue | null;
  if (!payload || payload.format !== "mhji-sites-migration-v1") {
    return Response.json({ error: "모현제일교회 이전 파일 형식이 아닙니다." }, { status: 400 });
  }

  const members = records(payload.members, 5000);
  const businesses = records(payload.businesses, 5000);
  const applications = records(payload.businessApplications, 5000);
  if (!members || !businesses || !applications) {
    return Response.json({ error: "이전 파일의 데이터 구조나 수량을 확인해 주세요." }, { status: 400 });
  }
  if (businesses.some((item) => item.type !== "business")) {
    return Response.json({ error: "성도사업장 이외의 게시물이 포함돼 있습니다." }, { status: 400 });
  }

  await ensureNetlifySchema();
  const db = getNetlifyDb();
  const statements = [
    ...members.map((item) =>
      db.prepare(
        `INSERT INTO members
         (id, username, password_hash, password_salt, name, phone, birth_date,
          position, status, force_password_change, approved_at, approved_by,
          last_login_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          username=excluded.username, password_hash=excluded.password_hash,
          password_salt=excluded.password_salt, name=excluded.name, phone=excluded.phone,
          birth_date=excluded.birth_date, position=excluded.position, status=excluded.status,
          force_password_change=excluded.force_password_change,
          approved_at=excluded.approved_at, approved_by=excluded.approved_by,
          last_login_at=excluded.last_login_at, created_at=excluded.created_at,
          updated_at=excluded.updated_at`,
      ).bind(
        string(item.id), string(item.username), string(item.password_hash),
        string(item.password_salt), string(item.name), string(item.phone),
        string(item.birth_date), string(item.position), string(item.status, "pending"),
        integer(item.force_password_change), nullableString(item.approved_at),
        nullableString(item.approved_by), nullableString(item.last_login_at),
        string(item.created_at), string(item.updated_at),
      ),
    ),
    ...businesses.map((item) =>
      db.prepare(
        `INSERT INTO content_posts
         (id, type, title, date, excerpt, category, content, images, status,
          sort_order, created_at, updated_at)
         VALUES (?, 'business', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          type='business', title=excluded.title, date=excluded.date,
          excerpt=excluded.excerpt, category=excluded.category, content=excluded.content,
          images=excluded.images, status=excluded.status, sort_order=excluded.sort_order,
          created_at=excluded.created_at, updated_at=excluded.updated_at`,
      ).bind(
        string(item.id), string(item.title), string(item.date), string(item.excerpt),
        string(item.category), string(item.content), string(item.images, "[]"),
        string(item.status, "published"), integer(item.sort_order),
        string(item.created_at), string(item.updated_at),
      ),
    ),
    ...applications.map((item) =>
      db.prepare(
        `INSERT INTO business_applications
         (id, member_id, applicant_name, applicant_phone, business_name, category,
          owner_name, business_phone, address, description, website, image_url,
          status, admin_note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          member_id=excluded.member_id, applicant_name=excluded.applicant_name,
          applicant_phone=excluded.applicant_phone, business_name=excluded.business_name,
          category=excluded.category, owner_name=excluded.owner_name,
          business_phone=excluded.business_phone, address=excluded.address,
          description=excluded.description, website=excluded.website,
          image_url=excluded.image_url, status=excluded.status,
          admin_note=excluded.admin_note, created_at=excluded.created_at,
          updated_at=excluded.updated_at`,
      ).bind(
        string(item.id), string(item.member_id), string(item.applicant_name),
        string(item.applicant_phone), string(item.business_name), string(item.category),
        string(item.owner_name), string(item.business_phone), string(item.address),
        string(item.description), string(item.website), string(item.image_url),
        string(item.status, "pending"), string(item.admin_note),
        string(item.created_at), string(item.updated_at),
      ),
    ),
  ];

  try {
    if (statements.length) await db.batch(statements);
    return Response.json({
      ok: true,
      imported: {
        members: members.length,
        businesses: businesses.length,
        businessApplications: applications.length,
      },
    });
  } catch (error) {
    console.error("Migration import failed", error);
    return Response.json(
      { error: "데이터를 가져오지 못했습니다. 기존 데이터와 중복되는 계정이 있는지 확인해 주세요." },
      { status: 500 },
    );
  }
}
