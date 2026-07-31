import { getMemberSession } from "../../../member-auth";
import { deleteUploadedImages } from "../../../../lib/content";
import {
  hasExternalR2,
  putExternalObject,
} from "../../../../lib/external-r2";

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxBytes = 5 * 1024 * 1024;

function safeName(name: string) {
  return name
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9가-힣._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-90) || "image";
}

function memberDirectory(memberId: string) {
  return `businesses/applications/${memberId.replace(/[^a-zA-Z0-9-]/g, "")}/`;
}

export async function POST(request: Request) {
  const member = await getMemberSession();
  if (!member) {
    return Response.json({ error: "교인 로그인 후 신청할 수 있습니다." }, { status: 401 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "대표 이미지를 선택해 주세요." }, { status: 400 });
  }
  if (!supportedTypes.has(file.type) || file.size > maxBytes) {
    return Response.json(
      { error: "이미지를 자동 최적화하지 못했습니다. JPG·PNG·WEBP로 다시 저장해 주세요." },
      { status: 400 },
    );
  }
  const directory = memberDirectory(member.id);
  const key = `${directory}${crypto.randomUUID()}-${safeName(file.name)}`;
  if (!hasExternalR2()) {
    return Response.json({ error: "이미지 저장소를 사용할 수 없습니다." }, { status: 500 });
  }
  await putExternalObject(key, file, `member:${member.id}`);
  return Response.json(
    { image: `/api/media?store=external&key=${encodeURIComponent(key)}` },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const member = await getMemberSession();
  if (!member) {
    return Response.json({ error: "교인 로그인이 필요합니다." }, { status: 401 });
  }
  const payload = (await request.json().catch(() => null)) as { image?: unknown } | null;
  const image = typeof payload?.image === "string" ? payload.image : "";
  const url = new URL(image, "https://mhji.invalid");
  const key = url.searchParams.get("key") ?? "";
  const validExternal =
    url.searchParams.get("store") === "external" &&
    key.startsWith(memberDirectory(member.id));
  const validInternal = key.startsWith(`uploads/business-applications/${member.id}/`);
  if (!validExternal && !validInternal) {
    return Response.json({ error: "정리할 이미지를 확인해 주세요." }, { status: 400 });
  }
  await deleteUploadedImages([image]);
  return Response.json({ ok: true });
}
