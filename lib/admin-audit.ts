import { ensureNetlifySchema, getNetlifyDb, type PreparedStatement } from "./netlify-db";

export type AdminAuditInput = {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, string | number | boolean>;
};

const sensitiveKey = /(?:password|token|secret|phone|birth|content|body|image|url)/i;

function safeMetadata(metadata: AdminAuditInput["metadata"]) {
  return Object.fromEntries(
    Object.entries(metadata ?? {})
      .filter(([key]) => !sensitiveKey.test(key))
      .slice(0, 12)
      .map(([key, value]) => [key.slice(0, 50), String(value).slice(0, 120)]),
  );
}

export function adminAuditStatement(input: AdminAuditInput): PreparedStatement {
  return getNetlifyDb()
    .prepare(
      `INSERT INTO admin_audit_logs
       (id, actor_id, action, target_type, target_id, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.actorId,
      input.action,
      input.targetType,
      input.targetId ?? "",
      JSON.stringify(safeMetadata(input.metadata)),
    );
}

export async function recordAdminAudit(input: AdminAuditInput) {
  await ensureNetlifySchema();
  await adminAuditStatement(input).run();
}

export async function listAdminAudit(options: {
  page: number;
  pageSize?: number;
  query?: string;
  action?: string;
}) {
  await ensureNetlifySchema();
  const page = Math.max(1, Number.isFinite(options.page) ? options.page : 1);
  const pageSize = 20;
  const query = options.query?.trim().slice(0, 80) ?? "";
  const action = options.action?.trim().slice(0, 60) ?? "";
  const filters: string[] = [];
  const args: string[] = [];
  if (query) {
    filters.push("(actor_id LIKE ? OR action LIKE ? OR target_type LIKE ? OR target_id LIKE ?)");
    args.push(...Array(4).fill(`%${query}%`));
  }
  if (action) {
    filters.push("action = ?");
    args.push(action);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const db = getNetlifyDb();
  const count = await db
    .prepare(`SELECT COUNT(*) AS count FROM admin_audit_logs ${where}`)
    .bind(...args)
    .first<{ count: number | string }>();
  const rows = await db
    .prepare(
      `SELECT id, actor_id, action, target_type, target_id, metadata_json, created_at
       FROM admin_audit_logs ${where}
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .bind(...args, pageSize, (page - 1) * pageSize)
    .all<Record<string, unknown>>();
  return {
    total: Number(count?.count ?? 0),
    page,
    pageSize,
    logs: rows.results.map((row) => ({
      id: String(row.id),
      actorId: String(row.actor_id),
      action: String(row.action),
      targetType: String(row.target_type),
      targetId: String(row.target_id),
      metadata: JSON.parse(String(row.metadata_json || "{}")) as Record<string, string>,
      createdAt: String(row.created_at),
    })),
  };
}
