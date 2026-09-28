import { authorized, n8nConfig, n8nRequest, N8nRequestError } from "@/lib/n8n-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const config = n8nConfig();
  if (!config) return Response.json({ error: "Tender discovery is not configured." }, { status: 503 });
  if (!authorized(request, config.teamPassword)) return Response.json({ error: "Workspace access denied." }, { status: 401 });

  const source = new URL(request.url).searchParams.get("source");
  if (source !== "ted" && source !== "tavily") return Response.json({ error: "Choose TED or Tavily." }, { status: 400 });

  try {
    const result = await n8nRequest(config.origin, config.apiKey, `tenders/discover/${source}`);
    if (!result || typeof result !== "object" || !Array.isArray((result as { items?: unknown }).items)) throw new Error("Invalid discovery response");
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof N8nRequestError && [401, 403].includes(cause.status)) return Response.json({ error: "n8n rejected the discovery credential." }, { status: 502 });
    return Response.json({ error: "Tender scan failed. Try again shortly." }, { status: 502 });
  }
}
