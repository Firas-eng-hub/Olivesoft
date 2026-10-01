import { authorized, n8nConfig, n8nRequest, N8nRequestError } from "@/lib/n8n-server";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const config = n8nConfig();
  if (!config) return Response.json({ error: "Opportunities are not configured." }, { status: 503 });
  if (!authorized(request, config.teamPassword)) return Response.json({ error: "Workspace access denied." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Invalid request." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const leadId = typeof input.leadId === "string" ? input.leadId : "";
  const fields = ["comments", "priorities", "exclusions"] as const;
  if (!UUID.test(leadId) || fields.some((field) => input[field] !== undefined && typeof input[field] !== "string"))
    return Response.json({ error: "Invalid acceptance." }, { status: 400 });
  const guidance = Object.fromEntries(fields.map((field) => [field, String(input[field] ?? "").trim()])) as Record<(typeof fields)[number], string>;
  if (guidance.comments.length > 4000 || guidance.priorities.length > 2000 || guidance.exclusions.length > 2000)
    return Response.json({ error: "Guidance is too long." }, { status: 400 });
  try {
    const result = await n8nRequest(config.origin, config.apiKey, "olivesoft/v1/opportunities/accept", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ lead_id: leadId, ...guidance }),
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof N8nRequestError && cause.status === 409)
      return Response.json({ error: "Wait for a completed profile assessment before accepting." }, { status: 409 });
    return Response.json({ error: "Could not save acceptance." }, { status: 502 });
  }
}
