import {
  createContentPost,
  deleteUploadedImages,
  deleteContentPost,
  getContentPost,
  listContentPosts,
  updateContentPost,
  type ContentPostInput,
  type ContentType,
} from "../../../../lib/content";
import { requireAdminApi } from "../../../admin-auth";
import { env } from "cloudflare:workers";
import { hasExternalR2, putExternalObject } from "../../../../lib/external-r2";
import { getKoreaDate } from "../../../../lib/korea-date";

const allowedTypes = new Set<ContentType>(["bulletin", "news", "gallery", "business"]);
const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxImageBytes = 12 * 1024 * 1024;

function safeName(name: string) {
  return name
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9가-힣._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-90) || "image";
}

async function requestPayload(request: Request) {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return { payload: await request.json(), files: [] as File[], fileIds: [] as string[] };
  }
  const data = await request.formData();
  return {
    payload: JSON.parse(String(data.get("payload") || "{}")) as unknown,
    files: data.getAll("files").filter((value): value is File => value instanceof File),
    fileIds: data.getAll("fileIds").map(String),
  };
}

async function uploadPendingImages(
  input: ContentPostInput,
  files: File[],
  fileIds: string[],
  uploadedBy: string,
) {
  if (files.length !== fileIds.length) throw new Error("선택한 이미지 정보를 확인해 주세요.");
  const pendingIds = new Set(
    input.images.filter((image) => image.startsWith("pending:")).map((image) => image.slice(8)),
  );
  if (pendingIds.size !== files.length || fileIds.some((id) => !pendingIds.has(id))) {
    throw new Error("선택한 이미지 순서를 확인해 주세요.");
  }
  if (!files.length) return { input, uploaded: [] as string[] };

  const useExternalR2 = hasExternalR2();
  const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
  if (!useExternalR2 && !bucket) throw new Error("이미지 저장소를 사용할 수 없습니다.");

  const uploadedById = new Map<string, string>();
  const uploaded: string[] = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const id = fileIds[index];
      if (!supportedImageTypes.has(file.type) || file.size > maxImageBytes) {
        throw new Error("JPG·PNG·WEBP·GIF 이미지만 파일당 12MB까지 등록할 수 있습니다.");
      }
      const directory =
        input.type === "gallery"
          ? "gallery"
          : input.type === "business"
            ? "businesses"
            : "bulletins";
      const key = `${directory}/${crypto.randomUUID()}-${safeName(file.name)}`;
      let url: string;
      if (useExternalR2) {
        await putExternalObject(key, file, uploadedBy);
        url = `/api/media?store=external&key=${encodeURIComponent(key)}`;
      } else {
        const legacyKey = `uploads/${input.type}/${crypto.randomUUID()}-${safeName(file.name)}`;
        await bucket!.put(legacyKey, file.stream(), {
          httpMetadata: { contentType: file.type },
          customMetadata: { uploadedBy },
        });
        url = `/api/media?key=${encodeURIComponent(legacyKey)}`;
      }
      uploaded.push(url);
      uploadedById.set(id, url);
    }
    return {
      input: {
        ...input,
        images: input.images.map((image) =>
          image.startsWith("pending:") ? uploadedById.get(image.slice(8))! : image,
        ),
      },
      uploaded,
    };
  } catch (error) {
    await deleteUploadedImages(uploaded);
    throw error;
  }
}

async function authorize() {
  const user = await requireAdminApi();
  if (!user) {
    return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  return null;
}

function validateInput(value: unknown): ContentPostInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<ContentPostInput>;
  if (!input.type || !allowedTypes.has(input.type) || !input.title?.trim() || !input.date?.trim()) {
    return null;
  }
  return {
    type: input.type,
    title: input.title.trim(),
    date: input.date.trim(),
    excerpt: input.excerpt?.trim() ?? "",
    category: input.category?.trim() ?? "",
    content: input.content?.trim() ?? "",
    images: Array.isArray(input.images)
      ? input.images.filter((item): item is string => typeof item === "string")
      : [],
    status: input.status === "draft" ? "draft" : "published",
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
  };
}

export async function GET() {
  const denied = await authorize();
  if (denied) return denied;
  return Response.json({ posts: await listContentPosts({ includeDrafts: true, limit: 200 }) });
}

export async function POST(request: Request) {
  const user = await requireAdminApi();
  if (!user) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  let requestData: Awaited<ReturnType<typeof requestPayload>>;
  try {
    requestData = await requestPayload(request);
  } catch {
    return Response.json(
      { error: "업로드 요청을 읽지 못했습니다. 이미지 용량과 인터넷 연결을 확인해 주세요." },
      { status: 400 },
    );
  }
  const { payload, files, fileIds } = requestData;
  const input = validateInput(payload);
  if (!input) {
    return Response.json({ error: "제목과 날짜를 확인해 주세요." }, { status: 400 });
  }
  let uploaded: string[] = [];
  try {
    const prepared = await uploadPendingImages(
      { ...input, date: getKoreaDate() },
      files,
      fileIds,
      user.email,
    );
    uploaded = prepared.uploaded;
    const id = await createContentPost(prepared.input);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    if (uploaded.length) await deleteUploadedImages(uploaded);
    return Response.json(
      { error: error instanceof Error ? error.message : "저장하지 못했습니다." },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  const user = await requireAdminApi();
  if (!user) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  let requestData: Awaited<ReturnType<typeof requestPayload>>;
  try {
    requestData = await requestPayload(request);
  } catch {
    return Response.json(
      { error: "업로드 요청을 읽지 못했습니다. 이미지 용량과 인터넷 연결을 확인해 주세요." },
      { status: 400 },
    );
  }
  const payload = requestData.payload as { id?: string; post?: unknown };
  const input = validateInput(payload.post);
  if (!payload.id || !input) {
    return Response.json({ error: "수정할 게시물 정보를 확인해 주세요." }, { status: 400 });
  }
  const previous = await getContentPost(payload.id);
  let uploaded: string[] = [];
  try {
    const prepared = await uploadPendingImages(
      input,
      requestData.files,
      requestData.fileIds,
      user.email,
    );
    uploaded = prepared.uploaded;
    await updateContentPost(payload.id, prepared.input);
    if (previous) {
      await deleteUploadedImages(
        previous.images.filter((image) => !prepared.input.images.includes(image)),
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    if (uploaded.length) await deleteUploadedImages(uploaded);
    return Response.json(
      { error: error instanceof Error ? error.message : "저장하지 못했습니다." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const denied = await authorize();
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "게시물 ID가 없습니다." }, { status: 400 });
  const post = await getContentPost(id);
  await deleteContentPost(id);
  if (post) await deleteUploadedImages(post.images);
  return Response.json({ ok: true });
}
