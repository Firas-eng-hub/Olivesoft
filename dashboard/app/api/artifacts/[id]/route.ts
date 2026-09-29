import { authorized, n8nConfig, n8nRequest, N8nRequestError } from "@/lib/n8n-server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;
const STORAGE_ORIGIN = "https://okhntgauzbumgidpuyvx.supabase.co";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const config = n8nConfig();
  if (!config) return Response.json({ error: "Artifact delivery is not configured." }, { status: 503 });
  if (!authorized(request, config.teamPassword)) return Response.json({ error: "Workspace access denied." }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Invalid artifact ID." }, { status: 400 });
  try {
    const result = await n8nRequest(config.origin, config.apiKey, `artifact/download?id=${encodeURIComponent(id)}`);
    if (!result || typeof result !== "object") throw new Error("Invalid artifact response");
    const artifact = result as Record<string, unknown>;
    const kind = artifact.kind;
    if (kind !== "pdf" && kind !== "pptx") throw new Error("Invalid artifact kind");
    if (artifact.id !== id || artifact.mime_type !== MIME[kind]) throw new Error("Artifact metadata mismatch");
    const expectedSize = Number(artifact.size_bytes);
    if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > 25 * 1024 * 1024) throw new Error("Invalid artifact size");
    const signedPath = String(artifact.signed_url);
    const signedUrl = new URL(signedPath.startsWith("/object/sign/") ? `/storage/v1${signedPath}` : signedPath, STORAGE_ORIGIN);
    if (signedUrl.origin !== STORAGE_ORIGIN || !signedUrl.pathname.startsWith("/storage/v1/object/sign/olivesoft-proposals/")) throw new Error("Invalid artifact location");
    const file = await fetch(signedUrl, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) });
    if (!file.ok || !file.body) throw new Error("Storage download failed");
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength !== expectedSize) throw new Error("Artifact size mismatch");
    const signature = new Uint8Array(bytes.slice(0, 4));
    if (kind === "pdf" && String.fromCharCode(...signature) !== "%PDF") throw new Error("Invalid PDF signature");
    if (kind === "pptx" && !(signature[0] === 0x50 && signature[1] === 0x4b)) throw new Error("Invalid PPTX signature");
    return new Response(bytes, { headers: {
      "Content-Type": MIME[kind],
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="OliveSoft_Proposal_${id}.${kind}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (cause) {
    if (cause instanceof N8nRequestError && cause.status === 404) return Response.json({ error: "Artifact is not ready." }, { status: 404 });
    console.error("Artifact delivery failed", cause);
    return Response.json({ error: "Could not deliver artifact." }, { status: 502 });
  }
}
