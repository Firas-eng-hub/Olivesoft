import { randomUUID } from "node:crypto";
import { authorized, n8nConfig, n8nRequest, N8nRequestError } from "@/lib/n8n-server";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const config = n8nConfig();
  if (!config || !config.asyncIntake) return Response.json({ error: "Opportunity intake is not enabled." }, { status: 503 });
  if (!authorized(request, config.teamPassword)) return Response.json({ error: "Workspace access denied." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Invalid request." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const candidateId = String(data.candidateId ?? "");
  const input = data.input && typeof data.input === "object" && !Array.isArray(data.input) ? data.input as Record<string, unknown> : {};
  const title = String(input.title ?? "").trim();
  const organization = String(input.organization ?? "").trim();
  const summary = String(input.summary ?? "").trim();
  const deadline = String(input.deadline ?? "").trim();
  const requirements = Array.isArray(input.requirements) ? input.requirements.map((item) => String(item).trim()) : [];
  if (!UUID.test(candidateId) || title.length < 4 || title.length > 100 || organization.length < 2 || organization.length > 80 ||
      summary.length < 12 || summary.length > 700 || !/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
      Number.isNaN(Date.parse(deadline)) || new Date(deadline).toISOString().slice(0, 10) !== deadline ||
      requirements.length < 1 || requirements.length > 50 || requirements.some((item) => item.length < 4 || item.length > 500))
    return Response.json({ error: "Complete the opportunity details and at least one explicit requirement." }, { status: 400 });
  const key = request.headers.get("idempotency-key") || randomUUID();
  if (key.length < 8 || key.length > 200) return Response.json({ error: "Invalid idempotency key." }, { status: 400 });
  try {
    const result = await n8nRequest(config.origin, config.apiKey, "olivesoft/v1/opportunities/review", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidate_id: candidateId, idempotency_key: key,
        input: { title, organization, summary, deadline, requirements } }),
    }) as { lead_id?: unknown; job_id?: unknown };
    if (!result.lead_id || !result.job_id) throw new Error("Missing intake receipt");
    return Response.json({ leadId: String(result.lead_id), jobId: String(result.job_id) },
      { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof N8nRequestError && cause.status === 409)
      return Response.json({ error: "This opportunity is expired or already linked to another review." }, { status: 409 });
    return Response.json({ error: "Could not save the reviewed opportunity." }, { status: 502 });
  }
}
