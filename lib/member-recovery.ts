import { getNetlifyDb, ensureNetlifySchema } from "./netlify-db";
import { normalizeMemberName } from "./member-signup";
import { birthDateRecoveryHint } from "./member-recovery-input";
import { hashPassword } from "./members";

export const RECOVERY_SECONDS = 300;

async function digest(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

// Low-assurance recovery explicitly chosen by the site owner. Knowing these
// facts is not strong proof of identity. An opaque, expiring grant still
// prevents the client from choosing a member ID or reusing a completed reset.
export async function beginMemberRecovery(name: string, birthHint: string) {
  await ensureNetlifySchema();
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const tokenHash = await digest(token);
  await getNetlifyDb().writeTransaction(async tx => {
    const result = await tx.execute(
      `SELECT m.id, m.username, m.name, m.birth_date, COALESCE(a.representative_member_id, m.id) AS representative_id,
              COALESCE(a.enabled, 1) AS enabled
       FROM members m LEFT JOIN member_login_aliases a ON a.source_member_id = m.id`,
    );
    const ids = new Set(result.rows.filter(row => Number(row.enabled) === 1 &&
      normalizeMemberName(String(row.name)) === normalizeMemberName(name) &&
      birthDateRecoveryHint(String(row.birth_date ?? "")) === birthHint).map(row => String(row.representative_id)));
    if (ids.size !== 1) return;
    const id = [...ids][0];
    const admins = new Set([process.env.ADMIN_USERNAME?.trim(), process.env.ARCHIVE_ADMIN_USERNAME?.trim()].filter(Boolean));
    if (result.rows.some(row => String(row.representative_id) === id && admins.has(String(row.username)))) return;
    const current = await tx.execute({ sql: `SELECT m.status, COALESCE(s.session_version, 0) AS version
      FROM members m LEFT JOIN member_auth_state s ON s.member_id = m.id WHERE m.id = ?`, args: [id] });
    if (!current.rows[0] || !["pending", "approved"].includes(String(current.rows[0].status))) return;
    const now = Date.now();
    await tx.execute({ sql: "DELETE FROM member_recovery_grants WHERE expires_at <= ?", args: [now] });
    await tx.execute({ sql: `INSERT INTO member_recovery_grants (token_hash, member_id, session_version, expires_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(member_id) DO UPDATE SET token_hash = excluded.token_hash, session_version = excluded.session_version, expires_at = excluded.expires_at`,
      args: [tokenHash, id, Number(current.rows[0].version), now + RECOVERY_SECONDS * 1000] });
  });
  // Missing/ambiguous hints receive the same response and cookie shape, but
  // their token has no database grant and cannot change a password.
  return token;
}

export async function completeMemberRecovery(token: string | undefined, password: string) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const tokenHash = await digest(token);
  const { hash, salt } = await hashPassword(password);
  return getNetlifyDb().writeTransaction(async tx => {
    const grant = await tx.execute({ sql: `SELECT g.member_id, g.session_version, g.expires_at,
      COALESCE(s.session_version, 0) AS current_version, m.status
      FROM member_recovery_grants g JOIN members m ON m.id = g.member_id
      LEFT JOIN member_auth_state s ON s.member_id = m.id WHERE g.token_hash = ?`, args: [tokenHash] });
    const row = grant.rows[0];
    if (!row || Number(row.expires_at) <= Date.now() || Number(row.session_version) !== Number(row.current_version) || !["approved", "pending"].includes(String(row.status))) return false;
    const id = String(row.member_id);
    const members = await tx.execute({ sql: `SELECT a.member_id FROM member_merge_accounts a
      JOIN member_merge_groups g ON g.id = a.merge_id WHERE g.representative_member_id = ? AND g.status = 'active'`, args: [id] });
    const ids = [...new Set([id, ...members.rows.map(item => String(item.member_id))])];
    const marks = ids.map(() => "?").join(",");
    await tx.execute({ sql: `UPDATE members SET password_hash = ?, password_salt = ?, force_password_change = 0,
      updated_at = CURRENT_TIMESTAMP WHERE id IN (${marks})`, args: [hash, salt, ...ids] });
    await tx.execute({ sql: "UPDATE member_login_aliases SET password_hash = ?, password_salt = ?, updated_at = CURRENT_TIMESTAMP WHERE representative_member_id = ?", args: [hash, salt, id] });
    await tx.execute({ sql: `INSERT INTO member_auth_state (member_id, session_version, updated_at) VALUES (?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(member_id) DO UPDATE SET session_version = member_auth_state.session_version + 1, updated_at = CURRENT_TIMESTAMP`, args: [id] });
    await tx.execute({ sql: `DELETE FROM member_recovery_grants WHERE member_id IN (${marks})`, args: ids });
    await tx.execute({ sql: `UPDATE member_password_reset_requests SET resolved_at = CURRENT_TIMESTAMP WHERE member_id IN (${marks}) AND resolved_at IS NULL`, args: ids });
    await tx.execute({ sql: `INSERT INTO admin_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
      VALUES (?, ?, 'member.password_change', 'member', ?, '{"method":"name_birth_recovery"}')`, args: [crypto.randomUUID(), id, id] });
    return true;
  });
}
