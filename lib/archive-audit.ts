import { ensureNetlifySchema, getNetlifyDb } from "./netlify-db";
import { recordAdminAudit } from "./admin-audit";

export async function recordArchiveAudit(input: { actor: string; action: string; targetType: string; targetId?: string; summary: string; details?: Record<string, string> }) {
  await ensureNetlifySchema();
  await getNetlifyDb().prepare(`INSERT INTO archive_audit_logs (id, actor, action, target_type, target_id, summary, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), input.actor, input.action, input.targetType, input.targetId ?? "", input.summary, JSON.stringify(input.details ?? {})).run();
  await recordAdminAudit({
    actorId: input.actor,
    action: `archive.${input.action}`,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: { summary: input.summary, ...(input.details ?? {}) },
  });
}

export async function listArchiveAudit(options: { page: number; pageSize: number; query?: string }) {
  await ensureNetlifySchema();
  const page = Math.max(1, options.page); const pageSize = [20, 50, 100].includes(options.pageSize) ? options.pageSize : 20;
  const q = options.query?.trim() ?? ""; const where = q ? "WHERE actor LIKE ? OR action LIKE ? OR summary LIKE ?" : ""; const args = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
  const db = getNetlifyDb();
  const count = await db.prepare(`SELECT COUNT(*) AS count FROM archive_audit_logs ${where}`).bind(...args).first<{ count: number }>();
  const rows = await db.prepare(`SELECT id, actor, action, target_type, target_id, summary, details_json, created_at FROM archive_audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...args, pageSize, (page - 1) * pageSize).all<Record<string, unknown>>();
  return { total: Number(count?.count ?? 0), logs: rows.results.map((row) => ({ id:String(row.id), actor:String(row.actor), action:String(row.action), targetType:String(row.target_type), targetId:String(row.target_id), summary:String(row.summary), details:JSON.parse(String(row.details_json || "{}")), createdAt:String(row.created_at) })) };
}
