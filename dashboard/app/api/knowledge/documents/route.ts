import { authorized, n8nConfig, n8nRequest, N8nRequestError } from "@/lib/n8n-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const config = n8nConfig();
  if (!config) return Response.json({ error: "Knowledge inventory is not configured." }, { status: 503 });
  if (!authorized(request, config.teamPassword)) return Response.json({ error: "Workspace access denied." }, { status: 401 });

  try {
    const result = await n8nRequest(config.origin, config.apiKey, "knowledge/documents");
    if (!result || typeof result !== "object" || !("items" in result) || !Array.isArray(result.items)) throw new Error("Invalid knowledge inventory response");
    const items = result.items.map((value: unknown) => {
      const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
      return {
        id: String(row.id ?? ""),
        docId: String(row.doc_id ?? ""),
        kind: String(row.asset_type ?? ""),
        name: String(row.title ?? ""),
        version: Number(row.version ?? 0),
        state: String(row.state ?? "indexing"),
        storagePath: String(row.storage_path ?? ""),
        uploadedAt: String(row.created_at ?? ""),
      };
    }).filter((item) => item.id && ["cv", "expertise", "project"].includes(item.kind));
    return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("Could not load knowledge documents", cause);
    const error = cause instanceof N8nRequestError && (cause.status === 401 || cause.status === 403)
      ? "n8n rejected the dashboard API key for knowledge documents."
      : "Could not load saved knowledge documents.";
    return Response.json({ error }, { status: 502 });
  }
}
