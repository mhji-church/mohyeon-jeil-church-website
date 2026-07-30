import { env } from "cloudflare:workers";
import { normalizeMobilePhone } from "./phone";
import { deleteUploadedImages, ensureContentStore } from "./content";
import { getKoreaDate } from "./korea-date";

export type BusinessApplicationStatus = "pending" | "reviewed" | "completed";

export type BusinessApplication = {
  id: string;
  memberId: string;
  applicantName: string;
  applicantPhone: string;
  businessName: string;
  category: string;
  ownerName: string;
  businessPhone: string;
  address: string;
  description: string;
  website: string;
  imageUrl: string;
  status: BusinessApplicationStatus;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
};

export type BusinessApplicationInput = Pick<
  BusinessApplication,
  | "applicantName"
  | "applicantPhone"
  | "businessName"
  | "category"
  | "ownerName"
  | "businessPhone"
  | "address"
  | "description"
  | "website"
  | "imageUrl"
>;

function getD1() {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("사업장 신청 데이터베이스를 사용할 수 없습니다.");
  return db;
}

function mapRow(row: Record<string, unknown>): BusinessApplication {
  return {
    id: String(row.id),
    memberId: String(row.member_id),
    applicantName: String(row.applicant_name),
    applicantPhone: String(row.applicant_phone),
    businessName: String(row.business_name),
    category: String(row.category),
    ownerName: String(row.owner_name),
    businessPhone: String(row.business_phone),
    address: String(row.address),
    description: String(row.description),
    website: String(row.website),
    imageUrl: String(row.image_url ?? ""),
    status: row.status as BusinessApplicationStatus,
    adminNote: String(row.admin_note ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function validateBusinessApplication(input: BusinessApplicationInput) {
  const applicantName = input.applicantName.trim().slice(0, 30);
  const applicantPhone = normalizeMobilePhone(input.applicantPhone);
  const businessName = input.businessName.trim().slice(0, 80);
  const selectedCategory = input.category.trim().slice(0, 40);
  const ownerName = input.ownerName.trim().slice(0, 50);
  const businessPhone = input.businessPhone.trim().slice(0, 30);
  const address = input.address.trim().slice(0, 240);
  const description = input.description.trim().slice(0, 1000);
  const websiteInput = input.website.trim().slice(0, 300);
  const website =
    websiteInput && !/^https?:\/\//i.test(websiteInput)
      ? `https://${websiteInput}`
      : websiteInput;
  const imageUrl = input.imageUrl.trim().slice(0, 700);

  if (applicantName.length < 2) return { error: "신청자 이름을 확인해 주세요." };
  if (!applicantPhone) return { error: "신청자 휴대전화 번호를 확인해 주세요." };
  if (!businessName) return { error: "사업장명을 입력해 주세요." };
  if (!selectedCategory) return { error: "업종 분류를 선택해 주세요." };
  if (!ownerName) return { error: "대표자·성도명을 입력해 주세요." };
  if (!address) return { error: "사업장 주소를 입력해 주세요." };
  if (!description) return { error: "사업장 소개를 입력해 주세요." };
  if (website) {
    try {
      const parsed = new URL(website);
      if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
        throw new Error();
      }
    } catch {
      return { error: "홈페이지·SNS 주소를 확인해 주세요." };
    }
  }
  return {
    value: {
      applicantName,
      applicantPhone,
      businessName,
      category: selectedCategory,
      ownerName,
      businessPhone,
      address,
      description,
      website,
      imageUrl,
    },
  };
}

export async function createBusinessApplication(
  memberId: string,
  input: BusinessApplicationInput,
) {
  const validated = validateBusinessApplication(input);
  if (!validated.value) throw new Error(validated.error);
  const id = crypto.randomUUID();
  await getD1()
    .prepare(
      `INSERT INTO business_applications
      (id, member_id, applicant_name, applicant_phone, business_name, category,
       owner_name, business_phone, address, description, website, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      memberId,
      validated.value.applicantName,
      validated.value.applicantPhone,
      validated.value.businessName,
      validated.value.category,
      validated.value.ownerName,
      validated.value.businessPhone,
      validated.value.address,
      validated.value.description,
      validated.value.website,
      validated.value.imageUrl,
    )
    .run();
  return id;
}

export async function listBusinessApplications() {
  const result = await getD1()
    .prepare(
      `SELECT * FROM business_applications
       ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END,
       created_at DESC`,
    )
    .all<Record<string, unknown>>();
  return result.results.map(mapRow);
}

export async function updateBusinessApplication(
  id: string,
  status: BusinessApplicationStatus,
  adminNote: string,
) {
  await getD1()
    .prepare(
      `UPDATE business_applications
       SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(status, adminNote.trim().slice(0, 500), id)
    .run();
}

export async function completeBusinessApplication(
  id: string,
  adminNote: string,
) {
  await ensureContentStore();
  const db = getD1();
  const row = await db
    .prepare(
      `SELECT business_applications.*, members.position AS member_position
       FROM business_applications
       LEFT JOIN members ON members.id = business_applications.member_id
       WHERE business_applications.id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) throw new Error("신청 정보를 찾지 못했습니다.");
  const application = mapRow(row);
  const memberPosition = String(row.member_position ?? "").trim();
  const ownerWithPosition =
    memberPosition &&
    application.ownerName !== memberPosition &&
    !application.ownerName.endsWith(` ${memberPosition}`)
      ? `${application.ownerName} ${memberPosition}`
      : application.ownerName;
  const postId = `business-application-${application.id}`;
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO content_posts
        (id, type, title, date, excerpt, category, content, images, status, sort_order)
        VALUES (?, 'business', ?, ?, ?, ?, ?, ?, 'draft', 0)`,
      )
      .bind(
        postId,
        application.businessName,
        getKoreaDate(),
        application.description,
        application.category,
        JSON.stringify({
          owner: ownerWithPosition,
          address: application.address,
          phone: application.businessPhone,
          website: application.website,
        }),
        JSON.stringify(application.imageUrl ? [application.imageUrl] : []),
      ),
    db
      .prepare(
        `UPDATE business_applications
         SET status = 'completed', admin_note = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(adminNote.trim().slice(0, 500), id),
  ]);
}

export async function deleteBusinessApplication(id: string) {
  const db = getD1();
  const row = await db
    .prepare("SELECT image_url, status FROM business_applications WHERE id = ?")
    .bind(id)
    .first<{ image_url?: string; status?: string }>();
  await db
    .prepare("DELETE FROM business_applications WHERE id = ?")
    .bind(id)
    .run();
  if (row?.image_url && row.status !== "completed") {
    await deleteUploadedImages([row.image_url]);
  }
}
