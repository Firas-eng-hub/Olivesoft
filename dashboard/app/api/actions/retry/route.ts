import { randomUUID } from "node:crypto";
import { authorized, n8nConfig, n8nRequest, N8nRequestError } from "@/lib/n8n-server";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const config = n8nConfig();
  if (!config || !config.asyncIntake) return Response.json({ error: "Durable retry is not configured." }, { status: 503 });
  if (!authorized(request, config.teamPassword)) return Response.json({ error: "Workspace access denied." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const leadId = body && typeof body === "object" && "leadId" in body ? String(body.leadId) : "";
  const key = request.headers.get("idempotency-key") || randomUUID();
  if (!UUID.test(leadId) || key.length < 8 || key.length > 200) return Response.json({ error: "Invalid retry request." }, { status: 400 });
  try {
    const result = await n8nRequest(config.origin, config.apiKey, "olivesoft/v1/actions/retry", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ lead_id: leadId, idempotency_key: key }),
    });
    if (!result || typeof result !== "object" || !("job_id" in result)) throw new Error("Missing job ID");
    return Response.json({ jobId: String(result.job_id) }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof N8nRequestError && cause.status === 409) return Response.json({ error: "This lead is not ready for retry." }, { status: 409 });
    return Response.json({ error: "Could not queue retry." }, { status: 502 });
  }
}
