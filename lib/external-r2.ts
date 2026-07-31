type ExternalR2Environment = {
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_ENDPOINT?: string;
  R2_BUCKET_NAME?: string;
};

type R2Config = {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: URL;
  bucket: string;
};

const encoder = new TextEncoder();
const r2RequestTimeoutMs = 30_000;

function getConfig(): R2Config | null {
  const runtime = process.env as ExternalR2Environment;
  const accessKeyId = runtime.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = runtime.R2_SECRET_ACCESS_KEY?.trim();
  const endpointValue = runtime.R2_ENDPOINT?.trim();
  const bucket = runtime.R2_BUCKET_NAME?.trim();
  if (!accessKeyId || !secretAccessKey || !endpointValue || !bucket) return null;

  try {
    const endpoint = new URL(endpointValue);
    endpoint.pathname = endpoint.pathname.replace(/\/+$/, "");
    return { accessKeyId, secretAccessKey, endpoint, bucket };
  } catch {
    return null;
  }
}

export function hasExternalR2() {
  return getConfig() !== null;
}

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string | ArrayBuffer) {
  const data = typeof value === "string" ? encoder.encode(value) : value;
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

async function hmac(key: ArrayBuffer | Uint8Array, value: string) {
  const keyBytes = key instanceof Uint8Array
    ? key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer
    : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
}

function encodePath(value: string) {
  return value
    .split("/")
    .map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    ))
    .join("/");
}

async function signedRequest(
  method: "GET" | "PUT" | "DELETE",
  key: string,
  options?: { body?: ArrayBuffer; contentType?: string; uploadedBy?: string },
) {
  const config = getConfig();
  if (!config) throw new Error("외부 R2 환경변수가 설정되지 않았습니다.");

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = `${config.endpoint.pathname}/${encodePath(config.bucket)}/${encodePath(key)}`
    .replace(/\/{2,}/g, "/");
  const url = new URL(config.endpoint);
  url.pathname = canonicalUri;

  const body = options?.body ?? new ArrayBuffer(0);
  const payloadHash = await sha256(body);
  const metadata = options?.uploadedBy
    ? encodeURIComponent(options.uploadedBy).slice(0, 180)
    : "";
  const headers = new Headers({
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  });
  if (options?.contentType) headers.set("content-type", options.contentType);
  if (metadata) headers.set("x-amz-meta-uploaded-by", metadata);

  const signedHeaderNames = [...headers.keys()].sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers.get(name)?.trim()}\n`)
    .join("");
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join("\n");

  const dateKey = await hmac(encoder.encode(`AWS4${config.secretAccessKey}`), dateStamp);
  const regionKey = await hmac(dateKey, "auto");
  const serviceKey = await hmac(regionKey, "s3");
  const signingKey = await hmac(serviceKey, "aws4_request");
  const signature = toHex(await hmac(signingKey, stringToSign));
  headers.set(
    "authorization",
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), r2RequestTimeoutMs);
  try {
    return await fetch(url, {
      method,
      headers,
      body: method === "PUT" ? body : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Cloudflare 이미지 저장소의 응답이 지연되고 있습니다.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function putExternalObject(
  key: string,
  file: File,
  uploadedBy: string,
) {
  const response = await signedRequest("PUT", key, {
    body: await file.arrayBuffer(),
    contentType: file.type || "application/octet-stream",
    uploadedBy,
  });
  if (!response.ok) {
    throw new Error(`R2 업로드 실패 (${response.status})`);
  }
}

export async function getExternalObject(key: string) {
  return signedRequest("GET", key);
}

export async function deleteExternalObjects(keys: string[]) {
  await Promise.all(
    keys.map(async (key) => {
      const response = await signedRequest("DELETE", key);
      if (!response.ok && response.status !== 404) {
        throw new Error(`R2 파일 삭제 실패 (${response.status})`);
      }
    }),
  );
}
