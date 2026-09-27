import { authorized, n8nConfig, n8nRequest } from "@/lib/n8n-server";

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
  if (title.length < 4 || title.length > 100 || organization.length < 2 || organization.length > 80 || summary.length < 12 || summary.length > 700 || (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline))) return Response.json({ error: "Tender details are invalid." }, { status: 400 });
  try {
    const result = await n8nRequest(config.origin, config.apiKey, "tenders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, organization, summary, deadline, source: "manual" }) });
    if (!result || typeof result !== "object" || !("lead_id" in result)) throw new Error("Missing lead ID");
    return Response.json({ leadId: String(result.lead_id) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "n8n could not create the tender." }, { status: 502 });
  }
}
