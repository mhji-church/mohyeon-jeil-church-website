import { normalizeMobilePhone } from "./phone";
import { ensureNetlifySchema, getNetlifyDb } from "./netlify-db";

export type MemberStatus = "pending" | "approved" | "suspended";

export type Member = {
  id: string;
  username: string;
  name: string;
  phone: string;
  birthDate: string;
  position: string;
  status: MemberStatus;
  forcePasswordChange: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemberSignupInput = {
  username: string;
  password: string;
  name: string;
  phone: string;
  birthDate: string;
  position: string;
};

const PASSWORD_HASH_ITERATIONS = 100_000;

function getD1() {
  return getNetlifyDb();
}

export async function ensureMemberStore() {
  // The members table is provisioned by the checked-in D1 migration.
  // Do not cache request-scoped D1 promises in module state: a Worker isolate can
  // reuse that promise for a later request and leave every member operation
  // waiting until Cloudflare cancels it.
  await ensureNetlifySchema();
}

function mapMember(row: Record<string, unknown>): Member {
  return {
    id: String(row.id),
    username: String(row.username),
    name: String(row.name),
    phone: String(row.phone),
    birthDate: String(row.birth_date ?? ""),
    position: String(row.position ?? ""),
    status: row.status as MemberStatus,
    forcePasswordChange: Boolean(row.force_password_change),
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateSignupInput(input: MemberSignupInput) {
  const username = normalizeUsername(input.username);
  const name = input.name.trim();
  const phone = normalizeMobilePhone(input.phone);
  const birthDate = input.birthDate.trim();
  const position = input.position.trim();

  if (!/^[a-z0-9][a-z0-9._-]{3,29}$/.test(username)) {
    return { error: "아이디는 영문 소문자와 숫자를 포함해 4~30자로 입력해 주세요." };
  }
  if (name.length < 2 || name.length > 30) {
    return { error: "이름을 2~30자로 입력해 주세요." };
  }
  if (!phone) {
    return { error: "휴대전화 번호를 확인해 주세요." };
  }
  if (input.password.length < 6 || input.password.length > 72) {
    return { error: "비밀번호는 6~72자로 입력해 주세요." };
  }
  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return { error: "생년월일을 확인해 주세요." };
  }
  return {
    value: {
      username,
      password: input.password,
      name,
      phone,
      birthDate,
      position: position.slice(0, 40),
    },
  };
}

export async function createMember(input: MemberSignupInput) {
  await ensureMemberStore();
  const validated = validateSignupInput(input);
  if (!validated.value) throw new Error(validated.error);
  const exists = await getD1()
    .prepare("SELECT id FROM members WHERE username = ?")
    .bind(validated.value.username)
    .first();
  if (exists) throw new Error("이미 사용 중인 아이디입니다.");

  const { hash, salt } = await hashPassword(validated.value.password);
  const id = crypto.randomUUID();
  await getD1()
    .prepare(
      `INSERT INTO members
      (id, username, password_hash, password_salt, name, phone, birth_date, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      validated.value.username,
      hash,
      salt,
      validated.value.name,
      validated.value.phone,
      validated.value.birthDate,
      validated.value.position,
    )
    .run();
  return id;
}

export async function authenticateMember(username: string, password: string) {
  await ensureMemberStore();
  const row = await getD1()
    .prepare("SELECT * FROM members WHERE username = ?")
    .bind(normalizeUsername(username))
    .first<Record<string, unknown>>();
  if (!row) return null;
  const valid = await verifyPassword(
    password,
    String(row.password_hash),
    String(row.password_salt),
  );
  if (!valid) return null;
  return {
    member: mapMember(row),
    passwordHash: String(row.password_hash),
  };
}

export async function recordMemberLogin(id: string) {
  await ensureMemberStore();
  await getD1()
    .prepare(
      "UPDATE members SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(id)
    .run();
}

export async function getMember(id: string) {
  await ensureMemberStore();
  const row = await getD1()
    .prepare("SELECT * FROM members WHERE id = ?")
    .bind(id)
    .first<Record<string, unknown>>();
  return row ? mapMember(row) : null;
}

export async function listMembers() {
  await ensureMemberStore();
  const result = await getD1()
    .prepare(
      `SELECT * FROM members
       ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
       created_at DESC`,
    )
    .all<Record<string, unknown>>();
  return result.results.map(mapMember);
}

export async function updateMember(
  id: string,
  input: Partial<Pick<Member, "name" | "phone" | "birthDate" | "position" | "status">>,
  adminUsername: string,
) {
  await ensureMemberStore();
  const current = await getMember(id);
  if (!current) throw new Error("회원을 찾을 수 없습니다.");
  const status = input.status ?? current.status;
  const phone = normalizeMobilePhone(input.phone ?? current.phone);
  if (!phone) {
    throw new Error("휴대전화 번호를 확인해 주세요.");
  }
  const approvedAt =
    status === "approved" && current.status !== "approved"
      ? new Date().toISOString()
      : current.approvedAt;
  const approvedBy =
    status === "approved" && current.status !== "approved"
      ? adminUsername
      : current.approvedBy;

  await getD1()
    .prepare(
      `UPDATE members SET
       name = ?, phone = ?, birth_date = ?, position = ?, status = ?,
       approved_at = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(
      (input.name ?? current.name).trim(),
      phone,
      (input.birthDate ?? current.birthDate).trim(),
      (input.position ?? current.position).trim().slice(0, 40),
      status,
      approvedAt,
      approvedBy,
      id,
    )
    .run();
}

export async function updateMemberProfile(
  id: string,
  input: Pick<Member, "name" | "phone" | "birthDate" | "position">,
) {
  await ensureMemberStore();
  const current = await getMember(id);
  if (!current) throw new Error("회원 정보를 찾을 수 없습니다.");

  const name = input.name.trim();
  const phone = normalizeMobilePhone(input.phone);
  const birthDate = input.birthDate.trim();
  const position = input.position.trim();

  if (name.length < 2 || name.length > 30) {
    throw new Error("이름을 2~30자로 입력해 주세요.");
  }
  if (!phone) {
    throw new Error("휴대전화 번호를 확인해 주세요.");
  }
  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new Error("생년월일을 확인해 주세요.");
  }
  if (position.length > 40) {
    throw new Error("직분 또는 소속 부서는 40자 이내로 입력해 주세요.");
  }

  await getD1()
    .prepare(
      `UPDATE members SET
       name = ?, phone = ?, birth_date = ?, position = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(name, phone, birthDate, position, id)
    .run();
}

export async function resetMemberPassword(id: string) {
  await ensureMemberStore();
  const member = await getMember(id);
  if (!member) throw new Error("회원을 찾을 수 없습니다.");
  const temporaryPassword = createTemporaryPassword();
  const { hash, salt } = await hashPassword(temporaryPassword);
  await getD1()
    .prepare(
      `UPDATE members SET password_hash = ?, password_salt = ?,
       force_password_change = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(hash, salt, id)
    .run();
  return temporaryPassword;
}

export async function changeMemberPassword(id: string, password: string) {
  if (password.length < 6 || password.length > 72) {
    throw new Error("새 비밀번호는 6~72자로 입력해 주세요.");
  }
  await ensureMemberStore();
  const { hash, salt } = await hashPassword(password);
  await getD1()
    .prepare(
      `UPDATE members SET password_hash = ?, password_salt = ?,
       force_password_change = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(hash, salt, id)
    .run();
}

export async function deleteMember(id: string) {
  await ensureMemberStore();
  await getD1().prepare("DELETE FROM members WHERE id = ?").bind(id).run();
}

async function hashPassword(password: string, suppliedSalt?: Uint8Array) {
  const salt = suppliedSalt ?? crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
      iterations: PASSWORD_HASH_ITERATIONS,
    },
    keyMaterial,
    256,
  );
  return {
    hash: toBase64Url(new Uint8Array(derived)),
    salt: toBase64Url(salt),
  };
}

async function verifyPassword(password: string, expectedHash: string, salt: string) {
  const calculated = await hashPassword(password, fromBase64Url(salt));
  return constantTimeEqual(calculated.hash, expectedHash);
}

function createTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function constantTimeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return mismatch === 0;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
