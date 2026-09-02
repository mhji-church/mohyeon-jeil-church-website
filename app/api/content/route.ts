import { listContentPosts, type ContentType } from "../../../lib/content";
import { apiError } from "../../../lib/api-response";

const allowedTypes = new Set<ContentType>(["bulletin", "news", "gallery", "business"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedType = url.searchParams.get("type") as ContentType | null;
  if (requestedType && !allowedTypes.has(requestedType)) {
    return Response.json({ error: "지원하지 않는 콘텐츠 유형입니다." }, { status: 400 });
  }
  const limit = Number(url.searchParams.get("limit") || "100");
  try {
    const posts = await listContentPosts({
      type: requestedType ?? undefined,
      limit: Number.isFinite(limit) ? limit : 100,
    });
    return Response.json({
      posts: posts.map((post) =>
        post.type === "gallery"
          ? {
              id: post.id,
              type: post.type,
              title: post.title,
              date: post.date,
              excerpt: post.excerpt,
              category: post.category,
              coverImage: post.images[0] ?? "",
              imageCount: post.images.length,
              status: post.status,
            }
          : post,
      ),
    });
  } catch (error) {
    return apiError("content.list", error, "콘텐츠를 불러오지 못했습니다.", 503);
  }
}
