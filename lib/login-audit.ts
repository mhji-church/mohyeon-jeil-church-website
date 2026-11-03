import { isIP } from "node:net";
import { adminAuditStatement, recordAdminAudit } from "./admin-audit";
import { getNetlifyDb } from "./netlify-db";

function clientIp(request: Request) {
  // Netlify sets this header at its edge. Only trust forwarded-for in local previews.
  const forwarded = process.env.NODE_ENV === "development" ? request.headers.get("x-forwarded-for")?.split(",")[0] : null;
  const value = (request.headers.get("x-nf-client-connection-ip") || forwarded || "").trim();
  return isIP(value) ? value : "확인 불가";
}

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return "확인 불가";
  const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)
    ? "태블릿"
    : /iPhone|iPod|Mobile|Android/i.test(userAgent) ? "모바일" : "PC";
  const system = /Android/i.test(userAgent) ? "Android"
    : /iPhone|iPad|iPod/i.test(userAgent) ? "iOS"
      : /Windows/i.test(userAgent) ? "Windows"
        : /Macintosh|Mac OS X/i.test(userAgent) ? "macOS"
          : /Linux/i.test(userAgent) ? "Linux" : "기타 OS";
  const browser = /SamsungBrowser/i.test(userAgent) ? "Samsung Internet"
    : /EdgA|EdgiOS|Edg\//i.test(userAgent) ? "Edge"
      : /FxiOS|Firefox/i.test(userAgent) ? "Firefox"
        : /CriOS|Chrome/i.test(userAgent) ? "Chrome"
          : /Safari/i.test(userAgent) ? "Safari" : "기타 브라우저";
  return `${device} · ${system} · ${browser}`;
}

export async function recordLoginAudit(request: Request, kind: "admin" | "member", actorId: string) {
  const input = {
    actorId,
    action: `${kind}.login`,
    targetType: kind,
    targetId: kind === "member" ? actorId : "",
    metadata: {
      ipAddress: clientIp(request),
      device: deviceLabel(request.headers.get("user-agent")),
    },
  };
  if (kind === "member") {
    // An in-flight login must not reinsert identifiable history after withdrawal.
    const statement = adminAuditStatement(input);
    await getNetlifyDb().prepare(`INSERT INTO admin_audit_logs
      (id, actor_id, action, target_type, target_id, metadata_json)
      SELECT ?, ?, ?, ?, ?, ? FROM members WHERE id = ?`)
      .bind(...statement.args, actorId).run();
    return;
  }
  await recordAdminAudit(input);
}
