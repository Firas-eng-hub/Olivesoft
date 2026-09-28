import { mapJobsResponse, mapLead, mapLeadsResponse } from "@/lib/n8n-overview";
import { authorized, n8nConfig, n8nRequest } from "@/lib/n8n-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const config = n8nConfig();
  if (!config) return Response.json({ error: "Live overview is not configured." }, { status: 503 });
  if (!authorized(request, config.teamPassword)) return Response.json({ error: "Workspace access denied." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: "Invalid tender ID." }, { status: 400 });
  try {
    if (id) {
      const result = await n8nRequest(config.origin, config.apiKey, `lead?id=${id}`);
      if (result && typeof result === "object" && "error" in result) return Response.json({ error: "Tender not found." }, { status: 404 });
      return Response.json({ lead: mapLead(result) }, { headers: { "Cache-Control": "no-store" } });
    }
    const [leads, jobs] = await Promise.all([n8nRequest(config.origin, config.apiKey, "leads"), n8nRequest(config.origin, config.apiKey, "jobs")]);
    return Response.json(mapLeadsResponse(leads, mapJobsResponse(jobs)), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load live tenders from n8n." }, { status: 502 });
  }
}
