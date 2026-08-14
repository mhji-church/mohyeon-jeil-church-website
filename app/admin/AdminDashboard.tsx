"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  ContentPost,
  ContentPostInput,
  ContentType,
} from "../../lib/content";
import { getKoreaDate } from "../../lib/korea-date";
import {
  businessCategories,
  isBusinessCategory,
} from "../../lib/business-categories";
import { formatPhoneNumber } from "../../lib/phone";

type Props = {
  userName: string;
  userEmail: string;
  signOutPath: string;
  initialType: ContentType;
};

type PendingImage = {
  id: string;
  file: File;
  preview: string;
};

const directlySupportedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const convertibleImageTypes = new Set([
  "image/avif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/svg+xml",
]);
const supportedImageExtensions = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "bmp",
  "heic",
  "heif",
  "tif",
  "tiff",
  "svg",
]);
const maxSourceImageBytes = 80 * 1024 * 1024;
const maxGifBytes = 4 * 1024 * 1024;
// The Sites request gateway rejects multipart bodies well below the API route's
// own 5 MB limit. Keep the optimized file comfortably below 1 MB so FormData
// headers and fields cannot push an otherwise valid image over that boundary.
const uploadTargetBytes = 760 * 1024;
const uploadRetryTargetBytes = 360 * 1024;
const uploadTimeoutMs = 60_000;
const saveTimeoutMs = 30_000;

const typeMeta = {
  bulletin: {
    label: "주보",
    eyebrow: "WEEKLY BULLETIN",
    description: "주보 이미지를 면 순서대로 등록합니다.",
  },
  news: {
    label: "교회소식",
    eyebrow: "CHURCH NEWS",
    description: "한 주간의 교회 안내와 일정을 등록합니다.",
  },
  gallery: {
    label: "갤러리",
    eyebrow: "PHOTO ALBUM",
    description: "앨범별 설명과 여러 장의 사진을 등록합니다.",
  },
  business: {
    label: "성도사업장",
    eyebrow: "MEMBER BUSINESS DIRECTORY",
    description: "성도 사업장의 정보와 대표 이미지를 등록합니다.",
  },
} satisfies Record<ContentType, { label: string; eyebrow: string; description: string }>;

const emptyPost = (type: ContentType): ContentPostInput => ({
  type,
  title: "",
  date: getKoreaDate(),
  excerpt: "",
  category: type === "gallery" ? "CHURCH LIFE" : "",
  content:
    type === "news"
      ? JSON.stringify([["", ""]])
      : type === "business"
        ? JSON.stringify({ owner: "", address: "", phone: "", website: "https://" })
        : "",
  images: [],
  status: "published",
  sortOrder: 0,
});

function parseNewsItems(content: string) {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (item) =>
          Array.isArray(item) &&
          typeof item[0] === "string" &&
          typeof item[1] === "string",
      )
    ) {
      return parsed as string[][];
    }
  } catch {
    // Older free-form text becomes one editable news item.
  }
  return [["", content]];
}

function toNewsText(content: string) {
  return parseNewsItems(content)
    .map(([title, text]) => `${title} | ${text}`)
    .join("\n");
}

function fromNewsText(value: string) {
  return JSON.stringify(
    value
      .split("\n")
      .map((line) => {
        const divider = line.indexOf("|");
        return divider < 0
          ? ["안내", line.trim()]
          : [line.slice(0, divider).trim(), line.slice(divider + 1).trim()];
      })
      .filter(([, text]) => text),
  );
}

type BusinessDetails = {
  owner: string;
  address: string;
  phone: string;
  website: string;
};

function parseBusinessDetails(content: string): BusinessDetails {
  try {
    const parsed = JSON.parse(content) as Partial<BusinessDetails>;
    return {
      owner: typeof parsed.owner === "string" ? parsed.owner : "",
      address: typeof parsed.address === "string" ? parsed.address : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      website: typeof parsed.website === "string" ? parsed.website : "",
    };
  } catch {
    return { owner: "", address: "", phone: "", website: "" };
  }
}

function normalizeWebsiteAddress(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "https://";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

async function canvasBlob(
  bitmap: CanvasImageSource,
  width: number,
  height: number,
  type: string,
  quality: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: type !== "image/jpeg" });
  if (!context) throw new Error("이미지를 처리하지 못했습니다.");
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지를 처리하지 못했습니다."))),
      type,
      quality,
    );
  });
}

function fileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function imageKind(file: File) {
  const extension = fileExtension(file);
  if (extension === "heic" || extension === "heif") return "heic";
  if (extension === "tif" || extension === "tiff") return "tiff";
  if (extension === "gif" || file.type === "image/gif") return "gif";
  return "standard";
}

function isSupportedImage(file: File) {
  return (
    supportedImageExtensions.has(fileExtension(file)) ||
    directlySupportedImageTypes.has(file.type) ||
    convertibleImageTypes.has(file.type)
  );
}

async function heicBitmap(file: File) {
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.94,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return createImageBitmap(blob);
}

async function tiffBitmap(file: File) {
  const UTIF = await import("utif");
  const buffer = await file.arrayBuffer();
  const pages = UTIF.decode(buffer);
  if (!pages.length) throw new Error("TIFF 이미지에 표시할 페이지가 없습니다.");
  UTIF.decodeImage(buffer, pages[0]);
  const rgba = UTIF.toRGBA8(pages[0]);
  const canvas = document.createElement("canvas");
  canvas.width = pages[0].width;
  canvas.height = pages[0].height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("TIFF 이미지를 처리하지 못했습니다.");
  context.putImageData(
    new ImageData(new Uint8ClampedArray(rgba), pages[0].width, pages[0].height),
    0,
    0,
  );
  return createImageBitmap(canvas);
}

async function decodeImage(file: File) {
  const kind = imageKind(file);
  if (kind === "heic") return heicBitmap(file);
  if (kind === "tiff") return tiffBitmap(file);
  return createImageBitmap(file);
}

async function optimizeImage(
  file: File,
  contentType: ContentType,
  targetBytes = uploadTargetBytes,
) {
  const kind = imageKind(file);
  if (kind === "gif") {
    if (file.size > maxGifBytes) {
      throw new Error(
        "움직이는 GIF는 품질과 애니메이션 보존을 위해 4MB 이하만 등록할 수 있습니다. MP4로 변환하거나 GIF 용량을 줄여 주세요.",
      );
    }
    return file;
  }
  if (directlySupportedImageTypes.has(file.type) && file.size <= targetBytes) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeImage(file);
  } catch {
    throw new Error(
      "이 이미지 파일을 읽지 못했습니다. 파일이 손상되지 않았는지 확인하거나 JPG·PNG·WEBP로 다시 저장해 주세요.",
    );
  }

  try {
    const outputType = "image/webp";
    const maxLongestSide = contentType === "bulletin" ? 3840 : 2880;
    const longestSide = Math.max(bitmap.width, bitmap.height);
    let scale = Math.min(1, maxLongestSide / longestSide);
    let quality = 0.92;
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      blob = await canvasBlob(bitmap, width, height, outputType, quality);
      if (blob.size <= targetBytes) break;
      const sizeRatio = Math.sqrt(targetBytes / blob.size);
      scale *= Math.min(0.88, sizeRatio * 0.9);
      quality = Math.max(0.5, quality - 0.06);
    }

    if (!blob || blob.size > targetBytes) {
      throw new Error(
        "자동 최적화 후에도 업로드 가능한 크기로 줄이지 못했습니다. 이미지의 긴 변을 4000px 이하로 줄여 다시 시도해 주세요.",
      );
    }
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, {
      type: outputType,
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function responseData(response: Response) {
  const raw = await response.text();
  try {
    return raw ? (JSON.parse(raw) as { error?: string; images?: string[] }) : {};
  } catch {
    return {};
  }
}

export default function AdminDashboard({
  userName,
  userEmail,
  signOutPath,
  initialType,
}: Props) {
  const [activeType, setActiveType] = useState<ContentType>(initialType);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContentPostInput>(emptyPost("bulletin"));
  const [newsText, setNewsText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<ContentPost | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/posts", { cache: "no-store" });
    const data = (await response.json()) as { posts?: ContentPost[]; error?: string };
    if (!response.ok) setNotice(data.error ?? "게시물을 불러오지 못했습니다.");
    setPosts(data.posts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPosts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPosts]);

  const visiblePosts = useMemo(
    () => posts.filter((post) => post.type === activeType),
    [activeType, posts],
  );

  const counts = useMemo(
    () =>
      (Object.keys(typeMeta) as ContentType[]).reduce(
        (result, type) => {
          result[type] = posts.filter((post) => post.type === type).length;
          return result;
        },
        { bulletin: 0, news: 0, gallery: 0, business: 0 },
      ),
    [posts],
  );

  const startCreate = () => {
    const next = emptyPost(activeType);
    setEditingId(null);
    setForm(next);
    setNewsText(activeType === "news" ? "| " : "");
    setEditorOpen(true);
    setNotice("");
    pendingImages.forEach((image) => URL.revokeObjectURL(image.preview));
    setPendingImages([]);
  };

  const startEdit = (post: ContentPost) => {
    setEditingId(post.id);
    setForm({
      type: post.type,
      title: post.title,
      date: post.date,
      excerpt: post.excerpt,
      category: post.category,
      content: post.content,
      images: [...post.images],
      status: post.status,
      sortOrder: post.sortOrder,
    });
    setNewsText(post.type === "news" ? toNewsText(post.content) : "");
    setEditorOpen(true);
    setNotice("");
    pendingImages.forEach((image) => URL.revokeObjectURL(image.preview));
    setPendingImages([]);
  };

  const updateField = <K extends keyof ContentPostInput>(
    key: K,
    value: ContentPostInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const updateBusinessField = (key: keyof BusinessDetails, value: string) =>
    setForm((current) => ({
      ...current,
      content: JSON.stringify({
        ...parseBusinessDetails(current.content),
        [key]: value,
      }),
    }));

  const selectImages = (files: FileList | null) => {
    if (!files?.length) return;
    setNotice("");
    const candidates = Array.from(files);
    const unsupportedFile = candidates.find((file) => !isSupportedImage(file));
    if (unsupportedFile) {
      setNotice(
        `${unsupportedFile.name}은 이미지 파일로 확인되지 않습니다. JPG·PNG·WEBP·HEIC·AVIF·BMP·TIFF·GIF·SVG 파일을 선택해 주세요.`,
      );
      return;
    }
    const oversizedFile = candidates.find((file) => file.size > maxSourceImageBytes);
    if (oversizedFile) {
      setNotice(
        `${oversizedFile.name}은 80MB를 초과합니다. 원본 이미지의 용량이나 해상도를 줄인 뒤 다시 선택해 주세요.`,
      );
      return;
    }
    const oversizedGif = candidates.find(
      (file) => imageKind(file) === "gif" && file.size > maxGifBytes,
    );
    if (oversizedGif) {
      setNotice(
        `${oversizedGif.name}은 4MB를 초과하는 GIF입니다. 애니메이션을 유지하려면 용량을 줄이거나 MP4로 변환해 주세요.`,
      );
      return;
    }
    const selected = candidates.map((file) => {
      const id = crypto.randomUUID();
      return { id, file, preview: URL.createObjectURL(file) };
    });
    setPendingImages((current) => [...current, ...selected]);
    setForm((current) => ({
      ...current,
      images: [...current.images, ...selected.map((image) => `pending:${image.id}`)],
    }));
    const needsOptimization = candidates.some(
      (file) =>
        file.size > uploadTargetBytes ||
        !directlySupportedImageTypes.has(file.type),
    );
    setNotice(
      needsOptimization
        ? "이미지를 선택했습니다. 게시물을 저장하면 웹용 형식과 용량으로 자동 최적화한 뒤 업로드합니다."
        : "이미지를 선택했습니다. 게시물을 저장할 때 업로드합니다.",
    );
  };

  const closeEditor = () => {
    pendingImages.forEach((image) => URL.revokeObjectURL(image.preview));
    setPendingImages([]);
    setEditorOpen(false);
  };

  const moveImage = (index: number, amount: number) => {
    setForm((current) => {
      const target = index + amount;
      if (target < 0 || target >= current.images.length) return current;
      const images = [...current.images];
      [images[index], images[target]] = [images[target], images[index]];
      return { ...current, images };
    });
  };

  const savePost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!form.title.trim() || !form.date.trim()) {
      setNotice("제목과 날짜를 입력해 주세요.");
      return;
    }
    if (
      (form.type === "bulletin" ||
        form.type === "gallery" ||
        form.type === "business") &&
      !form.images.length
    ) {
      setNotice("이미지를 한 장 이상 등록해 주세요.");
      return;
    }
    if (
      form.type === "business" &&
      (!form.category.trim() || form.category === "기타")
    ) {
      setNotice(
        form.category === "기타"
          ? "기타 업종명을 직접 입력해 주세요."
          : "업종 분류를 선택해 주세요.",
      );
      return;
    }
    setSaving(true);
    setUploading(pendingImages.length > 0);
    const post = {
      ...form,
      date: form.date,
      content: form.type === "news" ? fromNewsText(newsText) : form.content,
    };
    const uploadedImages: string[] = [];
    try {
      const uploadedById = new Map<string, string>();
      for (const pending of pendingImages) {
        const upload = async (targetBytes: number) => {
          const uploadBody = new FormData();
          uploadBody.append("type", form.type);
          uploadBody.append(
            "files",
            await optimizeImage(pending.file, form.type, targetBytes),
          );
          const response = await fetchWithTimeout(
            "/api/admin/uploads",
            { method: "POST", body: uploadBody },
            uploadTimeoutMs,
          );
          return { response, data: await responseData(response) };
        };

        let { response: uploadResponse, data: uploadData } =
          await upload(uploadTargetBytes);
        if (uploadResponse.status === 413) {
          ({ response: uploadResponse, data: uploadData } =
            await upload(uploadRetryTargetBytes));
        }
        if (!uploadResponse.ok || !uploadData.images?.[0]) {
          throw new Error(
            uploadResponse.status === 413
              ? "이미지를 충분히 줄인 뒤에도 서버가 전송을 차단했습니다. 잠시 후 다시 시도해 주세요."
              : uploadData.error ?? `이미지를 업로드하지 못했습니다. (오류 ${uploadResponse.status})`,
          );
        }
        uploadedImages.push(uploadData.images[0]);
        uploadedById.set(pending.id, uploadData.images[0]);
      }

      const savedPost = {
        ...post,
        images: post.images.map((image) =>
          image.startsWith("pending:") ? uploadedById.get(image.slice(8)) ?? image : image,
        ),
      };
      if (savedPost.images.some((image) => image.startsWith("pending:"))) {
        throw new Error("선택한 이미지 정보를 확인해 주세요.");
      }

      setUploading(false);
      const response = await fetchWithTimeout("/api/admin/posts", {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, post: savedPost } : savedPost),
      }, saveTimeoutMs);
      const data = await responseData(response);
      if (!response.ok) {
        throw new Error(data.error ?? `저장하지 못했습니다. (오류 ${response.status})`);
      }
      closeEditor();
      setNotice(editingId ? "게시물을 수정했습니다." : "새 게시물을 등록했습니다.");
      await loadPosts();
    } catch (error) {
      if (uploadedImages.length) {
        await fetch("/api/admin/uploads", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ images: uploadedImages }),
        }).catch(() => undefined);
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        setNotice("저장소 응답이 지연돼 저장을 중단했습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setNotice(error instanceof Error ? error.message : "저장하지 못했습니다.");
      }
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const deletePost = async () => {
    if (!confirmDelete) return;
    const response = await fetch(
      `/api/admin/posts?id=${encodeURIComponent(confirmDelete.id)}`,
      { method: "DELETE" },
    );
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error ?? "삭제하지 못했습니다.");
    } else {
      setNotice("게시물을 삭제했습니다.");
      setConfirmDelete(null);
      await loadPosts();
    }
  };

  return (
    <main className="admin-shell admin-members-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/" aria-label="모현제일교회 홈페이지">
          <img src="/assets/logo-horizontal.png" alt="모현제일교회" />
          <span>WEBSITE ADMIN</span>
        </Link>
        <nav aria-label="콘텐츠 관리 메뉴">
          {(Object.keys(typeMeta) as ContentType[]).map((type, index) => (
            <button
              type="button"
              className={activeType === type ? "is-active" : ""}
              onClick={() => {
                setActiveType(type);
                setEditorOpen(false);
              }}
              key={type}
            >
              <i>0{index + 1}</i>
              <span>{typeMeta[type].label} 관리</span>
              <b>{counts[type]}</b>
            </button>
          ))}
          <a className="admin-members-nav" href="/admin/members">
            <i>05</i>
            <span>회원 관리</span>
          </a>
          <a className="admin-members-nav" href="/admin/archive">
            <i>06</i>
            <span>예배 아카이브</span>
          </a>
        </nav>
        <div className="admin-account">
          <span>{userName}</span>
          <small>{userEmail}</small>
          <a href={signOutPath}>로그아웃</a>
        </div>
      </aside>

      <section className="admin-workspace admin-members-workspace">
        <header className="admin-topbar">
          <div>
            <span>{typeMeta[activeType].eyebrow}</span>
            <h1>{typeMeta[activeType].label} 관리</h1>
            <p>{typeMeta[activeType].description}</p>
          </div>
          <div>
            <a href={`/${activeType === "bulletin" ? "bulletin" : activeType}`} target="_blank">
              홈페이지에서 보기
            </a>
            <button type="button" onClick={startCreate}>
              + 새 {typeMeta[activeType].label} 등록
            </button>
          </div>
        </header>

        <div className="admin-stats admin-member-stats">
          {(Object.keys(typeMeta) as ContentType[]).map((type) => (
            <button type="button" onClick={() => setActiveType(type)} key={type}>
              <span>{typeMeta[type].label}</span>
              <strong>{counts[type]}</strong>
              <small>등록 게시물</small>
            </button>
          ))}
        </div>

        {notice && <div className="admin-notice" role="status">{notice}</div>}

        <section className="admin-list-panel">
          <header>
            <div>
              <h2>등록된 {typeMeta[activeType].label}</h2>
              <span>총 {visiblePosts.length}건</span>
            </div>
            <button type="button" onClick={() => void loadPosts()} aria-label="목록 새로고침">
              새로고침
            </button>
          </header>

          {loading ? (
            <div className="admin-empty">게시물을 불러오고 있습니다.</div>
          ) : visiblePosts.length === 0 ? (
            <div className="admin-empty">
              <strong>등록된 게시물이 없습니다.</strong>
              <button type="button" onClick={startCreate}>첫 게시물 등록하기</button>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-content-table">
                <thead>
                  <tr>
                    <th>대표 이미지</th>
                    <th>제목</th>
                    <th>날짜</th>
                    <th>상태</th>
                    <th>이미지</th>
                    <th><span className="sr-only">관리</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePosts.map((post) => (
                    <tr key={post.id}>
                      <td>
                        {post.images[0] ? (
                          <img src={post.images[0]} alt="" />
                        ) : (
                          <span className="admin-no-image">NEWS</span>
                        )}
                      </td>
                      <td>
                        <strong>{post.title}</strong>
                        <small>{post.excerpt || typeMeta[post.type].description}</small>
                      </td>
                      <td><time>{post.date}</time></td>
                      <td>
                        <span className={`admin-status ${post.status}`}>
                          {post.status === "published" ? "공개" : "임시저장"}
                        </span>
                      </td>
                      <td>{post.images.length}장</td>
                      <td>
                        <div className="admin-row-actions">
                          <button type="button" onClick={() => startEdit(post)}>수정</button>
                          <button type="button" onClick={() => setConfirmDelete(post)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {editorOpen && (
        <div className="admin-editor-backdrop" role="dialog" aria-modal="true">
          <form className="admin-editor" onSubmit={savePost}>
            <header>
              <div>
                <span>{editingId ? "EDIT CONTENT" : "NEW CONTENT"}</span>
                <h2>{editingId ? `${typeMeta[form.type].label} 수정` : `새 ${typeMeta[form.type].label} 등록`}</h2>
              </div>
              <button type="button" onClick={closeEditor} aria-label="닫기">×</button>
            </header>
            {notice && (
              <div className="admin-editor-notice" role="alert">
                {notice}
              </div>
            )}
            <div className="admin-editor-body">
              <div className="admin-field-row">
                <label>
                  <span>제목</span>
                  <input
                    value={form.title}
                    onChange={(event) => updateField("title", event.target.value)}
                    placeholder={`${typeMeta[form.type].label} 제목을 입력하세요`}
                    required
                  />
                </label>
                <label className="admin-date-field">
                  <span className="admin-field-heading">
                    <b>게시 날짜</b>
                    {!editingId && (
                      <small id="admin-post-date-help">
                        오늘 날짜가 기본 적용되며 필요하면 변경할 수 있습니다.
                      </small>
                    )}
                  </span>
                  <input
                    value={form.date}
                    onChange={(event) => updateField("date", event.target.value)}
                    aria-describedby={!editingId ? "admin-post-date-help" : undefined}
                    placeholder="2026.07.31"
                    required
                  />
                </label>
              </div>

              {form.type === "news" && (
                <>
                  <label>
                    <span>목록 요약</span>
                    <input
                      value={form.excerpt}
                      onChange={(event) => updateField("excerpt", event.target.value)}
                      placeholder="메인 화면과 목록에 표시할 한 줄 요약"
                    />
                  </label>
                  <label>
                    <span>교회소식 내용</span>
                    <textarea
                      value={newsText}
                      onChange={(event) => setNewsText(event.target.value)}
                      rows={10}
                      placeholder={"소제목 | 내용을 입력하세요\n모임 안내 | 2부 예배 후 월례회가 있습니다."}
                    />
                    <small>한 줄에 한 항목씩 ‘소제목 | 내용’ 형식으로 입력합니다.</small>
                  </label>
                </>
              )}

              {form.type === "gallery" && (
                <>
                  <div className="admin-field-row">
                    <label>
                      <span>앨범 분류</span>
                      <input
                        value={form.category}
                        onChange={(event) => updateField("category", event.target.value)}
                        placeholder="CHURCH LIFE"
                      />
                    </label>
                    <label>
                      <span>목록 요약</span>
                      <input
                        value={form.excerpt}
                        onChange={(event) => updateField("excerpt", event.target.value)}
                        placeholder="앨범 카드에 표시할 소개"
                      />
                    </label>
                  </div>
                  <label>
                    <span>앨범 상세 설명</span>
                    <textarea
                      value={form.content}
                      onChange={(event) => updateField("content", event.target.value)}
                      rows={5}
                      placeholder="앨범을 열었을 때 표시할 설명을 입력하세요."
                    />
                  </label>
                </>
              )}

              {form.type === "business" && (
                <>
                  <div className="admin-field-row">
                    <label>
                      <span>업종 분류</span>
                      <select
                        value={
                          isBusinessCategory(form.category)
                            ? form.category
                            : form.category
                              ? "기타"
                              : ""
                        }
                        onChange={(event) =>
                          updateField("category", event.target.value)
                        }
                        required
                      >
                        <option value="">업종을 선택해 주세요</option>
                        {businessCategories.map((category) => (
                          <option value={category} key={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>대표자·성도명</span>
                      <input
                        value={parseBusinessDetails(form.content).owner}
                        onChange={(event) => updateBusinessField("owner", event.target.value)}
                        placeholder="예: 홍길동 집사"
                      />
                    </label>
                  </div>
                  {form.category &&
                    (!isBusinessCategory(form.category) ||
                      form.category === "기타") && (
                      <label>
                        <span>기타 업종명</span>
                        <input
                          value={form.category === "기타" ? "" : form.category}
                          onChange={(event) =>
                            updateField("category", event.target.value)
                          }
                          placeholder="업종명을 직접 입력해 주세요"
                          maxLength={40}
                          required
                        />
                      </label>
                    )}
                  <label>
                    <span>사업장 소개</span>
                    <textarea
                      value={form.excerpt}
                      onChange={(event) => updateField("excerpt", event.target.value)}
                      rows={4}
                      placeholder="사업장을 간단히 소개해 주세요."
                    />
                  </label>
                  <div className="admin-field-row">
                    <label>
                      <span>주소</span>
                      <input
                        value={parseBusinessDetails(form.content).address}
                        onChange={(event) => updateBusinessField("address", event.target.value)}
                        placeholder="사업장 주소"
                      />
                    </label>
                    <label>
                      <span>연락처</span>
                      <input
                        value={parseBusinessDetails(form.content).phone}
                        onChange={(event) =>
                          updateBusinessField("phone", formatPhoneNumber(event.target.value))
                        }
                        inputMode="tel"
                        placeholder="예: 031-000-0000"
                      />
                    </label>
                  </div>
                  <label>
                    <span>홈페이지·SNS 주소</span>
                    <input
                      value={parseBusinessDetails(form.content).website}
                      onChange={(event) => updateBusinessField("website", event.target.value)}
                      onBlur={(event) =>
                        updateBusinessField("website", normalizeWebsiteAddress(event.target.value))
                      }
                      inputMode="url"
                      placeholder="https://"
                    />
                  </label>
                </>
              )}

              {(form.type === "bulletin" ||
                form.type === "gallery" ||
                form.type === "business") && (
                <section className="admin-image-manager">
                  <div>
                    <span>
                      {form.type === "bulletin"
                        ? "주보 면 이미지"
                        : form.type === "gallery"
                          ? "앨범 사진"
                          : "사업장 대표 이미지"}
                    </span>
                    <label className="admin-upload-button">
                      {uploading ? "업로드 중…" : "+ 이미지 선택"}
                      <input
                        type="file"
                        accept="image/*,.heic,.heif,.avif,.bmp,.tif,.tiff,.svg"
                        multiple={form.type !== "business"}
                        onChange={(event) => {
                          if (form.type === "business" && form.images.length) {
                            setNotice("성도사업장 대표 이미지는 한 장만 등록할 수 있습니다.");
                          } else {
                            selectImages(event.target.files);
                          }
                          event.currentTarget.value = "";
                        }}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  {form.type === "business" ? (
                    <div className="admin-business-image-guide">
                      <strong>권장 이미지 규격</strong>
                      <span>16:9 가로형 · 1600×900px 이상</span>
                      <p>
                        1920×1080px을 권장합니다. 간판·상호와 주요 피사체는 사진
                        가장자리에 붙이지 말고 중앙에 배치해 주세요.
                      </p>
                    </div>
                  ) : (
                    <p>
                      {form.type === "bulletin"
                        ? "규격과 방향에 관계없이 등록할 수 있습니다. 1면부터 선택하고, 등록 후 화살표로 순서를 바꾸세요."
                        : "첫 번째 사진이 대표 이미지가 됩니다. 큰 원본과 휴대전화 사진도 저장할 때 자동 최적화됩니다."}
                    </p>
                  )}
                  <p className="admin-upload-help">
                    JPG·PNG·WEBP·HEIC·HEIF·AVIF·BMP·TIFF·GIF·SVG 지원 · 원본 최대 80MB ·
                    큰 이미지는 자동 최적화 · 움직이는 GIF는 최대 4MB
                  </p>
                  <div className="admin-image-grid">
                    {form.images.map((image, index) => (
                      <article key={`${image}-${index}`}>
                        <img
                          src={
                            image.startsWith("pending:")
                              ? pendingImages.find((item) => `pending:${item.id}` === image)?.preview
                              : image
                          }
                          alt={`${index + 1}번째 등록 이미지`}
                        />
                        <span>{index + 1}</span>
                        <div>
                          <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0}>←</button>
                          <button type="button" onClick={() => moveImage(index, 1)} disabled={index === form.images.length - 1}>→</button>
                          <button
                            type="button"
                            onClick={() => {
                              const removed = form.images[index];
                              if (removed?.startsWith("pending:")) {
                                setPendingImages((current) => {
                                  const target = current.find((item) => `pending:${item.id}` === removed);
                                  if (target) URL.revokeObjectURL(target.preview);
                                  return current.filter((item) => `pending:${item.id}` !== removed);
                                });
                              }
                              setForm((current) => ({
                                ...current,
                                images: current.images.filter((_, imageIndex) => imageIndex !== index),
                              }));
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </article>
                    ))}
                    {!form.images.length && (
                      <div className="admin-image-empty">아직 등록된 이미지가 없습니다.</div>
                    )}
                  </div>
                </section>
              )}

              <div className="admin-publish-options">
                <label>
                  <input
                    type="radio"
                    name="status"
                    checked={form.status === "published"}
                    onChange={() => updateField("status", "published")}
                  />
                  <span><strong>바로 공개</strong><small>저장 즉시 홈페이지에 표시합니다.</small></span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="status"
                    checked={form.status === "draft"}
                    onChange={() => updateField("status", "draft")}
                  />
                  <span><strong>임시저장</strong><small>관리자 목록에만 보관합니다.</small></span>
                </label>
              </div>
            </div>
            <footer>
              <button
                className="admin-editor-cancel"
                type="button"
                onClick={closeEditor}
              >
                취소
              </button>
              <button type="submit" disabled={saving || uploading}>
                {saving ? "저장 중…" : editingId ? "수정 내용 저장" : "게시물 등록"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {confirmDelete && (
        <div className="admin-confirm-backdrop" role="alertdialog" aria-modal="true">
          <section>
            <span>DELETE CONTENT</span>
            <h2>게시물을 삭제할까요?</h2>
            <p>‘{confirmDelete.title}’ 게시물은 삭제 후 홈페이지에서 바로 사라집니다.</p>
            <div>
              <button type="button" onClick={() => setConfirmDelete(null)}>취소</button>
              <button type="button" onClick={() => void deletePost()}>삭제</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
