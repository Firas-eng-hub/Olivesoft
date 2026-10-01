import { mapJobsResponse, mapLead, mapLeadsResponse } from "@/lib/n8n-overview";
import { authorized, n8nConfig, n8nRequest, N8nRequestError } from "@/lib/n8n-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const config = n8nConfig();
  if (!config) return Response.json({ error: "Live overview is not configured." }, { status: 503 });
  if (!authorized(request, config.teamPassword)) return Response.json({ error: "Workspace access denied." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: "Invalid opportunity ID." }, { status: 400 });
  try {
    if (id) {
      const result = await n8nRequest(config.origin, config.apiKey, `lead?id=${id}`);
      if (result && typeof result === "object" && "error" in result) return Response.json({ error: "Opportunity not found." }, { status: 404 });
      return Response.json({ lead: mapLead(result) }, { headers: { "Cache-Control": "no-store" } });
    }
    const leads = await n8nRequest(config.origin, config.apiKey, "leads");
    const data = mapLeadsResponse(leads);
    try {
      const jobs = await n8nRequest(config.origin, config.apiKey, "jobs");
      data.jobs = mapJobsResponse(jobs);
    } catch (cause) {
      console.error("Could not load n8n jobs", cause);
    }
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("Could not load n8n leads", cause);
    const error = cause instanceof N8nRequestError
      ? cause.status === 401 || cause.status === 403
        ? "n8n rejected the dashboard API key. Check OLIVESOFT_N8N_UPLOAD_API_KEY in Vercel against the n8n webhook credential."
        : cause.status === 404
          ? "The n8n leads webhook was not found. Check that wf5_api is published and the n8n URL is correct."
          : `The n8n leads webhook returned ${cause.status}.`
      : "Could not load live opportunities from n8n. Check the n8n connection and server logs.";
    return Response.json({ error }, { status: 502 });
  }
}
