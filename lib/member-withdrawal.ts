import { ensureNetlifySchema, getNetlifyDb } from "./netlify-db";
import { memberAttemptRateKey, verifyPassword } from "./members";

type WithdrawalResult = { status: "done" | "unauthenticated" | "incorrect" | "limited"; retryAfter?: number };
type Credential = { password_hash: string; password_salt: string };

// A session proof and credential are both rechecked under the same write lock
// that protects all deletion and redaction. There is no automatic write retry.
export async function withdrawMember(input: { memberId: string; sessionVersion: number; password: string; ip: string }): Promise<WithdrawalResult> {
  await ensureNetlifySchema();
  const rateKey = await memberAttemptRateKey(`withdrawal:${input.memberId}`, input.ip);
  return getNetlifyDb().writeTransaction(async tx => {
    const current = await tx.execute({
      sql: `SELECT m.id, m.password_hash, m.password_salt, m.status,
                   COALESCE(s.session_version, 0) AS session_version
            FROM members m LEFT JOIN member_auth_state s ON s.member_id = m.id WHERE m.id = ?`,
      args: [input.memberId],
    });
    const member = current.rows[0];
    if (!member || member.status === "suspended" || Number(member.session_version) !== input.sessionVersion) return { status: "unauthenticated" };
    const mergeRows = await tx.execute("SELECT id, representative_member_id, status FROM member_merge_groups");
    const accountRows = await tx.execute("SELECT merge_id, member_id FROM member_merge_accounts");
    const activeGroups = new Map(mergeRows.rows.filter(row => row.status === "active").map(row => [String(row.id), String(row.representative_member_id)]));
    // A merge performed after the session was verified requires a fresh login.
    if (accountRows.rows.some(row => String(row.member_id) === input.memberId && activeGroups.has(String(row.merge_id)) && activeGroups.get(String(row.merge_id)) !== input.memberId)) return { status: "unauthenticated" };
    const ids = new Set([input.memberId]);
    for (const [groupId, representative] of activeGroups) {
      if (representative === input.memberId) for (const row of accountRows.rows) if (String(row.merge_id) === groupId) ids.add(String(row.member_id));
    }
    const memberIds = [...ids];
    const marks = memberIds.map(() => "?").join(",");
    const identities = await tx.execute({ sql: `SELECT username, name FROM members WHERE id IN (${marks})`, args: memberIds });
    const limit = await tx.execute({ sql: "SELECT failed_count, blocked_until, updated_at FROM member_login_attempts WHERE rate_key = ?", args: [rateKey] });
    const now = Date.now();
    const previous = limit.rows[0];
    if (Number(previous?.blocked_until ?? 0) > now) return { status: "limited", retryAfter: Math.ceil((Number(previous!.blocked_until) - now) / 1000) };
    const aliases = await tx.execute({ sql: "SELECT password_hash, password_salt FROM member_login_aliases WHERE representative_member_id = ? AND enabled = 1", args: [input.memberId] });
    const allAliases = await tx.execute({ sql: "SELECT username FROM member_login_aliases WHERE representative_member_id = ?", args: [input.memberId] });
    const credentials = allAliases.rows.length ? aliases.rows : [member];
    let valid = false;
    for (const row of credentials) {
      const credential = row as unknown as Credential;
      if (await verifyPassword(input.password, String(credential.password_hash), String(credential.password_salt))) valid = true;
    }
    if (!valid) {
      const withinWindow = now - Number(previous?.updated_at ?? 0) <= 15 * 60_000;
      const failures = (withinWindow ? Number(previous?.failed_count ?? 0) : 0) + 1;
      const blockedUntil = failures >= 5 ? now + 5 * 60_000 : 0;
      await tx.execute({ sql: `INSERT INTO member_login_attempts (rate_key, failed_count, blocked_until, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(rate_key) DO UPDATE SET failed_count = excluded.failed_count, blocked_until = excluded.blocked_until, updated_at = excluded.updated_at`, args: [rateKey, failures, blockedUntil, now] });
      return blockedUntil ? { status: "limited", retryAfter: Math.max(1, Math.ceil((blockedUntil - Date.now()) / 1000)) } : { status: "incorrect" };
    }

    // Do not silently cascade a future, unreviewed member relationship.
    const knownReferences = new Set(["member_merge_groups", "member_merge_accounts", "member_login_aliases", "member_auth_state", "member_app_access", "member_password_reset_requests", "member_recovery_grants", "business_applications"]);
    const schema = await tx.execute("SELECT name, sql FROM sqlite_schema WHERE type = 'table'");
    if (schema.rows.some(row => /\b(?:member_id|source_member_id|representative_member_id)\b|REFERENCES\s+[\"`\[]?members\b/i.test(String(row.sql)) && !knownReferences.has(String(row.name)))) throw new Error("unreviewed-member-reference");
    const affectedGroups = mergeRows.rows.filter(group => ids.has(String(group.representative_member_id)) || accountRows.rows.some(account => String(account.merge_id) === String(group.id) && ids.has(String(account.member_id)))).map(row => String(row.id));
    const applications = await tx.execute({ sql: `SELECT id FROM business_applications WHERE member_id IN (${marks})`, args: memberIds });
    const references = [...memberIds, ...affectedGroups, ...applications.rows.map(row => String(row.id))];
    const refMarks = references.map(() => "?").join(",");
    const usernames = [...new Set([...identities.rows.map(row => String(row.username)), ...allAliases.rows.map(row => String(row.username))])];
    const actorLabels = new Set([...memberIds, ...usernames, ...identities.rows.map(row => String(row.name))]);
    const usernameMarks = usernames.map(() => "?").join(",");
    const referenceConditions = references.map(() => "instr(metadata_json, ?) > 0").join(" OR ");
    const anonymousRef = `withdrawn:${crypto.randomUUID()}`;
    const labels = [...actorLabels];
    const labelMarks = labels.map(() => "?").join(",");
    // Redact whole related entries in one write rather than one round trip per
    // login record. Keep administrator actors and event timestamps/actions.
    await tx.execute({ sql: `UPDATE admin_audit_logs SET actor_id = CASE
        WHEN actor_id IN (${marks}) OR (action IN ('member.login', 'member.password_change', 'member.withdrawal') AND actor_id IN (${labelMarks})) THEN ? ELSE actor_id END,
        target_type = 'withdrawn_member', target_id = ?, metadata_json = '{}'
      WHERE actor_id IN (${marks}) OR target_id IN (${refMarks}) OR ${referenceConditions}
         OR (action IN ('member.login', 'member.password_change', 'member.withdrawal') AND actor_id IN (${usernameMarks}))`,
      args: [...memberIds, ...labels, anonymousRef, anonymousRef, ...memberIds, ...references, ...references, ...usernames] });
    const archiveConditions = references.map(() => "instr(details_json, ?) > 0").join(" OR ");
    await tx.execute({ sql: `UPDATE archive_audit_logs SET actor = CASE WHEN actor IN (${marks}) THEN ? ELSE actor END,
      target_type = 'withdrawn_member', target_id = ?, summary = '탈퇴 회원 관련 기록', details_json = '{}'
      WHERE actor IN (${marks}) OR target_id IN (${refMarks}) OR ${archiveConditions}`,
      args: [...memberIds, anonymousRef, anonymousRef, ...memberIds, ...references, ...references] });
    // Delete member-owned applications, not their already-published public posts
    // or shared gallery/video/R2 objects. No external storage calls are made.
    for (const table of ["business_applications", "member_app_access", "member_password_reset_requests", "member_recovery_grants", "member_auth_state"]) {
      await tx.execute({ sql: `DELETE FROM ${table} WHERE member_id IN (${marks})`, args: memberIds });
    }
    await tx.execute({ sql: `DELETE FROM member_login_aliases WHERE representative_member_id IN (${marks}) OR source_member_id IN (${marks})`, args: [...memberIds, ...memberIds] });
    await tx.execute({ sql: `DELETE FROM member_merge_accounts WHERE member_id IN (${marks})`, args: memberIds });
    for (const groupId of affectedGroups) {
      await tx.execute({ sql: `UPDATE member_merge_groups SET status = 'reverted', resolved_profile_json = '{}', representative_member_id = CASE WHEN representative_member_id IN (${marks}) THEN ? ELSE representative_member_id END WHERE id = ?`, args: [...memberIds, anonymousRef, groupId] });
      await tx.execute({ sql: "DELETE FROM member_merge_groups WHERE id = ? AND NOT EXISTS (SELECT 1 FROM member_merge_accounts WHERE merge_id = ?)", args: [groupId, groupId] });
    }
    await tx.execute({ sql: `DELETE FROM members WHERE id IN (${marks})`, args: memberIds });
    await tx.execute({ sql: "DELETE FROM member_login_attempts WHERE rate_key = ?", args: [rateKey] });
    if ((await tx.execute("PRAGMA foreign_key_check")).rows.length) throw new Error("member-reference-integrity");
    await tx.execute({ sql: `INSERT INTO admin_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
      VALUES (?, ?, 'member.withdrawal', 'withdrawn_member', ?, '{"result":"success"}')`, args: [crypto.randomUUID(), anonymousRef, anonymousRef] });
    return { status: "done" };
  });
}
