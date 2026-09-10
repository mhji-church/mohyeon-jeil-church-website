import { adminAuditStatement } from "./admin-audit";
import {
  buildMemberDuplicateGroups,
  normalizeDuplicateBirthDate,
  normalizeDuplicatePhone,
  type MemberDuplicateGroup,
} from "./member-duplicates";
import { ensureNetlifySchema, getNetlifyDb } from "./netlify-db";

type RawMember = {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
  name: string;
  phone: string;
  birth_date: string;
  position: string;
  status: string;
  force_password_change: number | string;
  approved_at: string | null;
  approved_by: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberMergeAccountPreview = {
  id: string;
  username: string;
  name: string;
  phone: string;
  birthDate: string;
  position: string;
  status: string;
  forcePasswordChange: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  matchedFields: Array<"phone" | "birthDate">;
  isFirst: boolean;
  access: Array<{ appCode: string; accessLevel: string }>;
  relatedRecords: { businessApplications: number; archiveAccess: number };
  aliasEnabled: boolean;
};

export type MemberMergePreview = {
  groupId: string;
  fingerprint: string;
  accounts: MemberMergeAccountPreview[];
  recommendedRepresentativeId: string;
  recommendedProfile: { name: string; phone: string; birthDate: string; position: string };
  resolvedStatus: string;
  blockedReasons: string[];
  recordSummary: { businessApplications: number; archiveAccess: number };
};

export type MemberMergeInput = {
  fingerprint: string;
  representativeMemberId: string;
  profile: { name: string; phone: string; birthDate: string; position: string };
};

function candidate(row: RawMember) {
  return {
    id: String(row.id),
    username: String(row.username),
    name: String(row.name),
    phone: String(row.phone),
    birthDate: String(row.birth_date ?? ""),
    position: String(row.position ?? ""),
    status: String(row.status),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

async function listUnmergedRawMembers() {
  await ensureNetlifySchema();
  const rows = await getNetlifyDb().prepare(
    `SELECT members.* FROM members
     WHERE NOT EXISTS (
       SELECT 1 FROM member_merge_accounts account
       JOIN member_merge_groups merge_group ON merge_group.id = account.merge_id
       WHERE account.member_id = members.id
         AND merge_group.status = 'active'
         AND account.is_representative = 0
     )
     ORDER BY members.created_at ASC, members.id ASC`,
  ).all<RawMember>();
  return rows.results;
}

export async function resolveRepresentativeMemberId(memberId: string) {
  await ensureNetlifySchema();
  const row = await getNetlifyDb().prepare(
    `SELECT merge_group.representative_member_id
     FROM member_merge_accounts account
     JOIN member_merge_groups merge_group ON merge_group.id = account.merge_id
     WHERE account.member_id = ? AND merge_group.status = 'active'
     LIMIT 1`,
  ).bind(memberId).first<{ representative_member_id: string }>();
  return row?.representative_member_id ? String(row.representative_member_id) : memberId;
}

export async function getMergedMemberIds(memberId: string) {
  const representativeId = await resolveRepresentativeMemberId(memberId);
  const rows = await getNetlifyDb().prepare(
    `SELECT account.member_id FROM member_merge_accounts account
     JOIN member_merge_groups merge_group ON merge_group.id = account.merge_id
     WHERE merge_group.representative_member_id = ? AND merge_group.status = 'active'
     ORDER BY account.member_id`,
  ).bind(representativeId).all<{ member_id: string }>();
  return rows.results.length
    ? rows.results.map((row) => String(row.member_id))
    : [representativeId];
}

export async function getMemberSessionVersion(memberId: string) {
  const representativeId = await resolveRepresentativeMemberId(memberId);
  const row = await getNetlifyDb().prepare(
    "SELECT session_version FROM member_auth_state WHERE member_id = ?",
  ).bind(representativeId).first<{ session_version: number | string }>();
  return { representativeId, version: Number(row?.session_version ?? 0), managed: Boolean(row) };
}

export async function getMemberLoginAlias(username: string) {
  await ensureNetlifySchema();
  return getNetlifyDb().prepare(
    `SELECT username, source_member_id, representative_member_id,
            password_hash, password_salt, enabled
     FROM member_login_aliases WHERE username = ?`,
  ).bind(username).first<{
    username: string;
    source_member_id: string;
    representative_member_id: string;
    password_hash: string;
    password_salt: string;
    enabled: number | string;
  }>();
}

export async function listMemberLoginAliases(memberId: string) {
  const representativeId = await resolveRepresentativeMemberId(memberId);
  const rows = await getNetlifyDb().prepare(
    `SELECT username, source_member_id, enabled, created_at
     FROM member_login_aliases WHERE representative_member_id = ?
     ORDER BY created_at, username`,
  ).bind(representativeId).all<Record<string, unknown>>();
  return rows.results.map((row) => ({
    username: String(row.username),
    sourceMemberId: String(row.source_member_id),
    enabled: Number(row.enabled) === 1,
    createdAt: String(row.created_at ?? ""),
  }));
}

async function loadPreview(group: MemberDuplicateGroup): Promise<MemberMergePreview> {
  const db = getNetlifyDb();
  const rawMembers = await listUnmergedRawMembers();
  const rawById = new Map(rawMembers.map((row) => [String(row.id), row]));
  const accounts = await Promise.all(group.accounts.map(async (account) => {
    const [accessRows, businessCount] = await Promise.all([
      db.prepare(
        "SELECT app_code, access_level FROM member_app_access WHERE member_id = ? ORDER BY app_code",
      ).bind(account.id).all<{ app_code: string; access_level: string }>(),
      db.prepare(
        "SELECT COUNT(*) AS count FROM business_applications WHERE member_id = ?",
      ).bind(account.id).first<{ count: number | string }>(),
    ]);
    const access = accessRows.results.map((row) => ({
      appCode: String(row.app_code),
      accessLevel: String(row.access_level),
    }));
    return {
      ...account,
      position: account.position ?? "",
      lastLoginAt: account.lastLoginAt ?? null,
      forcePasswordChange: Number(rawById.get(account.id)?.force_password_change ?? 0) === 1,
      access,
      relatedRecords: {
        businessApplications: Number(businessCount?.count ?? 0),
        archiveAccess: access.filter((entry) => entry.accessLevel !== "none").length,
      },
      aliasEnabled: account.status !== "suspended",
    } satisfies MemberMergeAccountPreview;
  }));

  const approved = accounts.filter((account) => account.status === "approved");
  const representativePool = approved.length
    ? approved
    : accounts.filter((account) => account.status !== "suspended").length
      ? accounts.filter((account) => account.status !== "suspended")
      : accounts;
  const recommendedRepresentative = [...representativePool].sort((left, right) => {
    const leftRecords = left.relatedRecords.businessApplications + left.relatedRecords.archiveAccess;
    const rightRecords = right.relatedRecords.businessApplications + right.relatedRecords.archiveAccess;
    return rightRecords - leftRecords || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
  })[0]!;
  const newestFirst = [...accounts].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
  const latestValid = (field: "name" | "phone" | "birthDate" | "position") =>
    newestFirst.find((account) => {
      const value = account[field].trim();
      if (!value) return false;
      if (field === "phone") return Boolean(normalizeDuplicatePhone(value));
      if (field === "birthDate") return Boolean(normalizeDuplicateBirthDate(value));
      return true;
    })?.[field].trim() ?? "";

  const configuredAdmins = new Set([
    process.env.ADMIN_USERNAME?.trim(),
    process.env.ARCHIVE_ADMIN_USERNAME?.trim(),
  ].filter(Boolean));
  const blockedReasons: string[] = [];
  if (accounts.some((account) => configuredAdmins.has(account.username))) {
    blockedReasons.push("관리자 로그인 아이디와 같은 회원 계정이 포함되어 있습니다.");
  }
  if (accounts.some((account) => account.access.some((entry) => entry.accessLevel !== "none"))) {
    blockedReasons.push("아카이브 특별 권한이 설정된 계정이 포함되어 있어 일반 병합할 수 없습니다.");
  }

  return {
    groupId: group.id,
    fingerprint: group.fingerprint,
    accounts,
    recommendedRepresentativeId: recommendedRepresentative.id,
    recommendedProfile: {
      name: newestFirst[0]!.name.trim(),
      phone: latestValid("phone"),
      birthDate: latestValid("birthDate"),
      position: latestValid("position"),
    },
    resolvedStatus: recommendedRepresentative.status,
    blockedReasons,
    recordSummary: {
      businessApplications: accounts.reduce((sum, account) => sum + account.relatedRecords.businessApplications, 0),
      archiveAccess: accounts.reduce((sum, account) => sum + account.relatedRecords.archiveAccess, 0),
    },
  };
}

export async function getMemberMergePreview(groupId: string) {
  const members = (await listUnmergedRawMembers()).map(candidate);
  const group = buildMemberDuplicateGroups(members).find((item) => item.id === groupId);
  return group ? loadPreview(group) : null;
}

function selectedValue(
  accounts: MemberMergeAccountPreview[],
  field: "name" | "phone" | "birthDate" | "position",
  requested: string,
) {
  const trimmed = requested.trim();
  if (!trimmed && (field === "birthDate" || field === "position")) return "";
  if (!accounts.some((account) => account[field].trim() === trimmed)) {
    throw new Error("병합할 프로필 값을 다시 확인해 주세요.");
  }
  if (field === "phone" && !normalizeDuplicatePhone(trimmed)) throw new Error("휴대전화 번호를 확인해 주세요.");
  if (field === "birthDate" && trimmed && !normalizeDuplicateBirthDate(trimmed)) throw new Error("생년월일을 확인해 주세요.");
  return trimmed;
}

export async function mergeMemberAccounts(groupId: string, input: MemberMergeInput, actorId: string) {
  const preview = await getMemberMergePreview(groupId);
  if (!preview) throw new Error("중복 그룹이 변경됐습니다. 목록을 새로고침해 주세요.");
  if (preview.fingerprint !== input.fingerprint) throw new Error("중복 그룹 정보가 변경됐습니다. 다시 확인해 주세요.");
  if (preview.blockedReasons.length) throw new Error(preview.blockedReasons[0]);
  const representative = preview.accounts.find((account) => account.id === input.representativeMemberId);
  if (!representative) throw new Error("대표 회원을 확인해 주세요.");
  if (preview.accounts.some((account) => account.status === "approved") && representative.status !== "approved") {
    throw new Error("승인 계정이 포함된 경우 승인 계정을 대표 회원으로 선택해 주세요.");
  }

  const profile = {
    name: selectedValue(preview.accounts, "name", input.profile.name),
    phone: selectedValue(preview.accounts, "phone", input.profile.phone),
    birthDate: selectedValue(preview.accounts, "birthDate", input.profile.birthDate),
    position: selectedValue(preview.accounts, "position", input.profile.position),
  };
  const rawRows = await listUnmergedRawMembers();
  const rawById = new Map(rawRows.map((row) => [String(row.id), row]));
  const mergeId = crypto.randomUUID();
  const db = getNetlifyDb();
  const statements = [
    db.prepare(
      `INSERT INTO member_merge_groups
       (id, representative_member_id, resolved_profile_json, created_by)
       VALUES (?, ?, ?, ?)`,
    ).bind(mergeId, representative.id, JSON.stringify(profile), actorId),
  ];

  for (const account of preview.accounts) {
    const raw = rawById.get(account.id);
    if (!raw) throw new Error("병합 대상 계정이 변경됐습니다.");
    const originalMember = {
      id: account.id,
      username: account.username,
      name: account.name,
      phone: account.phone,
      birthDate: account.birthDate,
      position: account.position,
      status: account.status,
      forcePasswordChange: account.forcePasswordChange,
      approvedAt: raw.approved_at,
      approvedBy: raw.approved_by,
      lastLoginAt: account.lastLoginAt,
      createdAt: account.createdAt,
      updatedAt: raw.updated_at,
    };
    statements.push(
      db.prepare(
        `INSERT INTO member_merge_accounts
         (merge_id, member_id, is_representative, original_member_json,
          original_access_json, related_record_counts_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(
        mergeId,
        account.id,
        account.id === representative.id ? 1 : 0,
        JSON.stringify(originalMember),
        JSON.stringify(account.access),
        JSON.stringify(account.relatedRecords),
      ),
      db.prepare(
        `INSERT INTO member_login_aliases
         (username, source_member_id, representative_member_id, password_hash, password_salt, enabled)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(
        account.username,
        account.id,
        representative.id,
        raw.password_hash,
        raw.password_salt,
        account.aliasEnabled ? 1 : 0,
      ),
      db.prepare(
        `INSERT INTO member_auth_state (member_id, session_version, updated_at)
         VALUES (?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(member_id) DO UPDATE SET
           session_version = member_auth_state.session_version + 1,
           updated_at = CURRENT_TIMESTAMP`,
      ).bind(account.id),
    );
  }

  statements.push(
    db.prepare(
      `UPDATE members SET name = ?, phone = ?, birth_date = ?, position = ?,
       status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(
      profile.name,
      profile.phone,
      profile.birthDate,
      profile.position,
      representative.status,
      representative.id,
    ),
    adminAuditStatement({
      actorId,
      action: "member.merge",
      targetType: "member_merge",
      targetId: mergeId,
      metadata: {
        representativeMemberId: representative.id,
        accountCount: preview.accounts.length,
        resultingStatus: representative.status,
      },
    }),
  );
  await db.batch(statements);
  return { mergeId, representativeMemberId: representative.id, aliasCount: preview.accounts.length };
}

export async function setMemberLoginAliasEnabled(
  representativeMemberId: string,
  username: string,
  enabled: boolean,
  actorId: string,
) {
  const representativeId = await resolveRepresentativeMemberId(representativeMemberId);
  const aliases = await listMemberLoginAliases(representativeId);
  const alias = aliases.find((item) => item.username === username);
  if (!alias) throw new Error("로그인 아이디를 찾을 수 없습니다.");
  if (!enabled && alias.sourceMemberId === representativeId) {
    throw new Error("대표 회원의 로그인 아이디는 비활성화할 수 없습니다.");
  }
  const db = getNetlifyDb();
  await db.batch([
    db.prepare(
      `UPDATE member_login_aliases SET enabled = ?, updated_at = CURRENT_TIMESTAMP
       WHERE username = ? AND representative_member_id = ?`,
    ).bind(enabled ? 1 : 0, username, representativeId),
    db.prepare(
      `INSERT INTO member_auth_state (member_id, session_version, updated_at)
       VALUES (?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(member_id) DO UPDATE SET
         session_version = member_auth_state.session_version + 1,
         updated_at = CURRENT_TIMESTAMP`,
    ).bind(representativeId),
    adminAuditStatement({
      actorId,
      action: enabled ? "member.alias.enable" : "member.alias.disable",
      targetType: "member",
      targetId: representativeId,
      metadata: { aliasUsername: username },
    }),
  ]);
}
