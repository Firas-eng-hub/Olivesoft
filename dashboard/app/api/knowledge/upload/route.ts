import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 256 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

function safeEqual(actual: string, expected: string) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function failure(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const password = process.env.OLIVESOFT_UPLOAD_TEAM_PASSWORD;
  const webhookUrl = process.env.OLIVESOFT_N8N_UPLOAD_URL;
  const apiKey = process.env.OLIVESOFT_N8N_UPLOAD_API_KEY;
  if (!password || !webhookUrl || !apiKey) return failure("Upload integration is not configured.", 503);
  if (!safeEqual(request.headers.get("x-olivesoft-upload-password") ?? "", password)) return failure("Upload access denied.", 401);

  const requestSize = Number(request.headers.get("content-length") ?? 0);
  if (requestSize > MAX_REQUEST_BYTES) return failure("File is too large.", 413);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return failure("Expected a file upload.", 415);

  let form: FormData;
  try { form = await request.formData(); } catch { return failure("Invalid upload body.", 400); }
  const file = form.get("file");
  const kind = form.get("kind");
  if (!(file instanceof File) || !["cv", "expertise", "project"].includes(String(kind))) return failure("File and category are required.", 400);
  if (file.size === 0 || file.size > MAX_FILE_BYTES) return failure("File must be between 1 byte and 4 MB.", 413);

  const filename = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120);
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const expectedMime = MIME_BY_EXTENSION[extension];
  if (!expectedMime || file.type !== expectedMime) return failure("Only PDF, DOCX, and TXT files are supported.", 415);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (extension === "pdf" && new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return failure("Invalid PDF file.", 415);
  if (extension === "docx" && !(bytes[0] === 0x50 && bytes[1] === 0x4b)) return failure("Invalid DOCX file.", 415);

  let url: URL;
  try { url = new URL(webhookUrl); } catch { return failure("Upload destination is invalid.", 503); }
  if (url.protocol !== "https:" || !url.pathname.endsWith("/webhook/olivesoft/v1/knowledge/upload")) return failure("Upload destination is invalid.", 503);

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": expectedMime,
        "content-length": String(bytes.length),
        "x-olivesoft-kind": String(kind),
        "x-olivesoft-filename": filename,
      },
      body: bytes,
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok) {
      console.error("Knowledge upload webhook returned HTTP", upstream.status);
      if (upstream.status === 400 || upstream.status === 413 || upstream.status === 415) return failure("The upload was rejected. Check the file type, size, and category.", upstream.status);
      if (upstream.status === 401 || upstream.status === 403) return failure("Upload service authentication is misconfigured.", 502);
      return failure("Storage upload workflow failed. Please retry later.", 502);
    }
    const result: unknown = await upstream.json();
    if (typeof result !== "object" || result === null || !("storage_path" in result) || typeof result.storage_path !== "string" || !result.storage_path || !("bucket" in result) || typeof result.bucket !== "string" || !result.bucket) return failure("Supabase did not confirm the upload.", 502);
    return Response.json({ status: "uploaded", storagePath: result.storage_path, bucket: result.bucket, indexing: "pending" }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "TimeoutError") return failure("Storage upload timed out. Please retry later.", 504);
    return failure("Storage upload is unavailable. Please retry later.", 502);
  }
}
