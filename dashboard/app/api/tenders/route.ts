import { authorized, n8nConfig, n8nRequest, N8nRequestError } from "@/lib/n8n-server";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = n8nConfig();
  if (!config) return Response.json({ error: "Tender intake is not configured." }, { status: 503 });
  if (!authorized(request, config.teamPassword)) return Response.json({ error: "Workspace access denied." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const title = String(input.title ?? "").trim();
  const organization = String(input.organization ?? "").trim();
  const summary = String(input.summary ?? "").trim();
  const deadline = String(input.deadline ?? "").trim();
  const source = String(input.source ?? "manual").trim();
  const sourceUrl = String(input.sourceUrl ?? "").trim();
  const requirements = Array.isArray(input.requirements) ? input.requirements.map((item) => String(item).trim()) : [];
  if (requirements.length < 1 || requirements.length > 50 || requirements.some((item) => item.length < 4 || item.length > 500)) return Response.json({ error: "Add 1–50 explicit requirements." }, { status: 400 });
  if (title.length < 4 || title.length > 100 || organization.length < 2 || organization.length > 80 || summary.length < 12 || summary.length > 700 || (deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || Number.isNaN(Date.parse(deadline)) || new Date(deadline).toISOString().slice(0, 10) !== deadline))) return Response.json({ error: "Tender details are invalid." }, { status: 400 });
  if (!["manual", "ted", "tavily", "serpapi"].includes(source)) return Response.json({ error: "Tender source is invalid." }, { status: 400 });
  if (sourceUrl) {
    try { const url = new URL(sourceUrl); if (url.protocol !== "https:" || sourceUrl.length > 1000) throw new Error("Invalid URL"); }
    catch { return Response.json({ error: "Tender source URL is invalid." }, { status: 400 }); }
  }
  try {
    const key = request.headers.get("idempotency-key") || randomUUID();
    if (key.length < 8 || key.length > 200) return Response.json({ error: "Invalid idempotency key." }, { status: 400 });
    const result = await n8nRequest(config.origin, config.apiKey, config.asyncIntake ? "olivesoft/v1/intake" : "tenders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, organization, summary, requirements, deadline, source, source_url: sourceUrl || null, ...(config.asyncIntake ? { idempotency_key: key } : {}) }) });
    if (!result || typeof result !== "object" || !("lead_id" in result)) throw new Error("Missing lead ID");
    if (config.asyncIntake && !("job_id" in result)) throw new Error("Missing job ID");
    const payload = result as { lead_id: unknown; job_id?: unknown };
    return Response.json({ leadId: String(payload.lead_id), ...(config.asyncIntake ? { jobId: String(payload.job_id) } : {}) }, { status: config.asyncIntake ? 202 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof N8nRequestError && cause.status === 409) return Response.json({ error: "This request key was used for different tender details." }, { status: 409 });
    return Response.json({ error: "n8n could not create the tender." }, { status: 502 });
  }
}
