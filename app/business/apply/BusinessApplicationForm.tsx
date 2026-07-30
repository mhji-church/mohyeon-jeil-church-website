"use client";

import { useState } from "react";
import { businessCategories } from "../../../lib/business-categories";

const supportedExtensions = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "avif", "bmp",
  "heic", "heif", "tif", "tiff", "svg",
]);
const maxSourceBytes = 80 * 1024 * 1024;
const uploadTargetBytes = 760 * 1024;
const uploadRetryBytes = 360 * 1024;

function extension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function isSupportedImage(file: File) {
  return file.type.startsWith("image/") || supportedExtensions.has(extension(file));
}

async function decodeImage(file: File) {
  const ext = extension(file);
  if (["heic", "heif"].includes(ext) || /hei[cf]/i.test(file.type)) {
    const heic2any = (await import("heic2any")).default;
    const output = await heic2any({ blob: file, toType: "image/png" });
    return createImageBitmap(Array.isArray(output) ? output[0] : output);
  }
  if (["tif", "tiff"].includes(ext) || /tiff/i.test(file.type)) {
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
  return createImageBitmap(file);
}

async function canvasBlob(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지를 처리하지 못했습니다.");
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지를 변환하지 못했습니다."))),
      "image/webp",
      quality,
    ),
  );
}

async function optimizeImage(file: File, targetBytes: number) {
  const directTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (directTypes.has(file.type) && file.size <= targetBytes) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeImage(file);
  } catch {
    throw new Error(
      "이미지를 읽지 못했습니다. 손상 여부를 확인하거나 JPG·PNG·WEBP로 다시 저장해 주세요.",
    );
  }
  try {
    const longestSide = Math.max(bitmap.width, bitmap.height);
    let scale = Math.min(1, 2880 / longestSide);
    let quality = 0.9;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      blob = await canvasBlob(bitmap, width, height, quality);
      if (blob.size <= targetBytes) break;
      scale *= Math.min(0.88, Math.sqrt(targetBytes / blob.size) * 0.9);
      quality = Math.max(0.5, quality - 0.06);
    }
    if (!blob || blob.size > targetBytes) {
      throw new Error("이미지를 업로드 가능한 크기로 줄이지 못했습니다.");
    }
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "business"}.webp`, {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}

type Props = {
  applicantName: string;
  applicantPhone: string;
};

export default function BusinessApplicationForm({
  applicantName,
  applicantPhone,
}: Props) {
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [completed, setCompleted] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  function selectImage(file: File | null) {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setNotice("");
    if (!file) {
      setImage(null);
      setImagePreview("");
      return;
    }
    if (file.size > maxSourceBytes) {
      setNotice("이미지 원본은 최대 80MB까지 선택할 수 있습니다.");
      setImage(null);
      setImagePreview("");
      return;
    }
    if (!isSupportedImage(file)) {
      setNotice("JPG·PNG·WEBP·HEIC·AVIF·BMP·TIFF·GIF·SVG 이미지를 선택해 주세요.");
      setImage(null);
      setImagePreview("");
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const finalCategory = category === "기타" ? customCategory.trim() : category;
    if (!finalCategory) {
      setNotice(
        category === "기타"
          ? "기타 업종명을 직접 입력해 주세요."
          : "업종 분류를 선택해 주세요.",
      );
      return;
    }
    setSaving(true);
    setNotice("");
    let uploadedImage = "";
    try {
      if (image) {
        const upload = async (targetBytes: number) => {
          const uploadBody = new FormData();
          uploadBody.append("file", await optimizeImage(image, targetBytes));
          const response = await fetch("/api/business-applications/image", {
            method: "POST",
            body: uploadBody,
          });
          const data = (await response.json().catch(() => ({}))) as {
            error?: string;
            image?: string;
          };
          return { response, data };
        };
        let { response: uploadResponse, data: uploadData } =
          await upload(uploadTargetBytes);
        if (uploadResponse.status === 413) {
          ({ response: uploadResponse, data: uploadData } =
            await upload(uploadRetryBytes));
        }
        if (!uploadResponse.ok || !uploadData.image) {
          throw new Error(uploadData.error ?? "이미지를 업로드하지 못했습니다.");
        }
        uploadedImage = uploadData.image;
      }
      const response = await fetch("/api/business-applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          applicantName,
          applicantPhone,
          businessName: String(form.get("businessName") ?? ""),
          category: finalCategory,
          ownerName: String(form.get("ownerName") ?? ""),
          businessPhone: String(form.get("businessPhone") ?? ""),
          address: String(form.get("address") ?? ""),
          description: String(form.get("description") ?? ""),
          website: String(form.get("website") ?? ""),
          imageUrl: uploadedImage,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "신청을 접수하지 못했습니다.");
      }
      setCompleted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (uploadedImage) {
        await fetch("/api/business-applications/image", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: uploadedImage }),
        }).catch(() => undefined);
      }
      setNotice(
        error instanceof Error ? error.message : "신청을 접수하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (completed) {
    return (
      <section className="business-application-section">
        <div className="business-application-complete">
          <span>APPLICATION RECEIVED</span>
          <h2>사업장 등록 신청이 접수됐습니다.</h2>
          <p>
            관리자가 내용을 확인한 뒤 성도사업장에 등록합니다.
            필요한 정보가 있으면 신청자 연락처로 안내드리겠습니다.
          </p>
          <a href="/business">성도사업장으로 돌아가기</a>
        </div>
      </section>
    );
  }

  return (
    <section className="business-application-section">
      <div className="business-application-layout">
        <aside>
          <span>REGISTRATION GUIDE</span>
          <h2>등록 전 확인해 주세요.</h2>
          <p>
            등록 신청은 승인된 교인 회원만 가능하며, 제출한 내용은 관리자 확인 후
            홈페이지에 게시됩니다.
          </p>
          <dl>
            <div>
              <dt>신청자</dt>
              <dd>{applicantName}</dd>
            </div>
            <div>
              <dt>연락처</dt>
              <dd>{applicantPhone}</dd>
            </div>
          </dl>
        </aside>

        <form className="business-application-form" onSubmit={submit}>
          <header>
            <span>BUSINESS INFORMATION</span>
            <h2>사업장 정보</h2>
          </header>
          {notice && <div className="business-form-notice" role="alert">{notice}</div>}
          <div className="business-form-row">
            <label>
              <span>사업장명</span>
              <input name="businessName" maxLength={80} required />
            </label>
            <label>
              <span>대표자·성도명</span>
              <input name="ownerName" defaultValue={applicantName} maxLength={50} required />
            </label>
          </div>
          <label>
            <span>업종 분류</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              required
            >
              <option value="">업종을 선택해 주세요</option>
              {businessCategories.map((item) => (
                <option value={item} key={item}>{item}</option>
              ))}
            </select>
          </label>
          {category === "기타" && (
            <label>
              <span>기타 업종명</span>
              <input
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
                maxLength={40}
                placeholder="업종명을 직접 입력해 주세요"
                required
              />
            </label>
          )}
          <div className="business-form-row">
            <label>
              <span>사업장 연락처</span>
              <input name="businessPhone" maxLength={30} placeholder="예: 031-000-0000" />
            </label>
            <label>
              <span>홈페이지·SNS</span>
              <input
                name="website"
                maxLength={300}
                placeholder="예: www.mhji.kr 또는 instagram.com/계정"
                inputMode="url"
              />
            </label>
          </div>
          <label>
            <span>사업장 주소</span>
            <input name="address" maxLength={240} required />
          </label>
          <label>
            <span>사업장 소개</span>
            <textarea
              name="description"
              rows={6}
              maxLength={1000}
              placeholder="주요 서비스와 사업장을 간단히 소개해 주세요."
              required
            />
          </label>
          <label className="business-image-field">
            <span>대표 이미지 <small>선택 · 1장</small></span>
            <input
              type="file"
              accept="image/*,.heic,.heif,.avif,.tif,.tiff"
              onChange={(event) => selectImage(event.target.files?.[0] ?? null)}
            />
            {imagePreview ? (
              <div className="business-image-preview">
                <img src={imagePreview} alt="선택한 대표 이미지 미리보기" />
                <button type="button" onClick={() => selectImage(null)}>이미지 삭제</button>
              </div>
            ) : (
              <small>규격과 비율은 제한하지 않으며, 큰 이미지는 자동으로 최적화합니다.</small>
            )}
          </label>
          <label className="business-form-consent">
            <input type="checkbox" required />
            <span>등록 검토와 연락을 위해 위 정보를 관리자에게 제공하는 데 동의합니다.</span>
          </label>
          <div className="business-form-actions">
            <a href="/business">취소</a>
            <button type="submit" disabled={saving}>
              {saving ? "이미지 최적화 및 접수 중…" : "등록 신청하기"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
