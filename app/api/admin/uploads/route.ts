import { env } from "cloudflare:workers";
import { requireAdminApi } from "../../../admin-auth";
import {
  hasExternalR2,
  putExternalObject,
} from "../../../../lib/external-r2";
import { deleteUploadedImages } from "../../../../lib/content";

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxBytes = 5 * 1024 * 1024;

function safeName(name: string) {
  return name
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9가-힣._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-90) || "image";
}

export async function POST(request: Request) {
  const user = await requireAdminApi();
  if (!user) {
    return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const form = await request.formData();
  const files = form.getAll("files").filter((value): value is File => value instanceof File);
  const type = String(form.get("type") || "content").replace(/[^a-z-]/g, "");
  if (!files.length) {
    return Response.json({ error: "업로드할 이미지를 선택해 주세요." }, { status: 400 });
  }
  if (files.length !== 1) {
    return Response.json({ error: "이미지는 한 장씩 업로드해 주세요." }, { status: 400 });
  }
  const useExternalR2 = hasExternalR2();
  const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
  if (!useExternalR2 && !bucket) {
    return Response.json({ error: "이미지 저장소를 사용할 수 없습니다." }, { status: 500 });
  }
  const uploaded: string[] = [];
  for (const file of files) {
    if (!supportedTypes.has(file.type) || file.size > maxBytes) {
      return Response.json(
        { error: "JPG·PNG·WEBP·GIF 이미지만 파일당 5MB까지 업로드할 수 있습니다." },
        { status: 400 },
      );
    }
    const directory =
      type === "gallery"
        ? "gallery"
        : type === "bulletin"
          ? "bulletins"
          : type === "business"
            ? "businesses"
            : `content/${type}`;
    const key = `${directory}/${crypto.randomUUID()}-${safeName(file.name)}`;
    if (useExternalR2) {
      await putExternalObject(key, file, user.email);
      uploaded.push(`/api/media?store=external&key=${encodeURIComponent(key)}`);
    } else {
      const legacyKey = `uploads/${type}/${crypto.randomUUID()}-${safeName(file.name)}`;
      await bucket!.put(legacyKey, file.stream(), {
        httpMetadata: { contentType: file.type },
        customMetadata: { uploadedBy: user.email },
      });
      uploaded.push(`/api/media?key=${encodeURIComponent(legacyKey)}`);
    }
  }
  return Response.json({ images: uploaded }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await requireAdminApi();
  if (!user) {
    return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const payload = (await request.json().catch(() => null)) as { images?: unknown } | null;
  const images = Array.isArray(payload?.images)
    ? payload.images.filter((image): image is string => typeof image === "string")
    : [];
  if (!images.length) {
    return Response.json({ error: "정리할 이미지가 없습니다." }, { status: 400 });
  }
  await deleteUploadedImages(images);
  return Response.json({ ok: true });
}
