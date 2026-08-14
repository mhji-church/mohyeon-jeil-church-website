import { serveArchiveThumbnail } from "@/lib/archive-thumbnail";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serveArchiveThumbnail(id, request.headers.get("cookie"));
}
