import { authorized, n8nConfig, n8nRequest, N8nRequestError } from "@/lib/n8n-server";

export const runtime = "nodejs";

type Row = Record<string, unknown>;

export async function GET(request: Request) {
  const config = n8nConfig();
  if (!config) return Response.json({ error: "Opportunities are not configured." }, { status: 503 });
  if (!authorized(request, config.teamPassword)) return Response.json({ error: "Workspace access denied." }, { status: 401 });
  try {
    const result = await n8nRequest(config.origin, config.apiKey, "olivesoft/v1/opportunities") as { items?: unknown };
    if (!result || !Array.isArray(result.items)) throw new Error("Invalid opportunities response");
    const items = result.items.filter((item): item is Row => !!item && typeof item === "object" && !Array.isArray(item)).map((row) => ({
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      organization: String(row.organization ?? ""),
      summary: String(row.summary ?? ""),
      requirements: Array.isArray(row.requirements) ? row.requirements.filter((value): value is string => typeof value === "string") : [],
      url: String(row.source_url ?? ""),
      source: String(row.source ?? ""),
      publishedAt: row.published_at ? String(row.published_at) : null,
      deadline: row.deadline ? String(row.deadline) : null,
      status: String(row.status ?? "needs_review"),
      leadId: row.lead_id ? String(row.lead_id) : null,
      fitScore: row.fit_score === null || row.fit_score === undefined || !Number.isFinite(Number(row.fit_score))
        ? null : Math.max(0, Math.min(100, Number(row.fit_score))),
      assessment: String(row.assessment ?? "insufficient_evidence"),
      mandatoryGaps: Number(row.mandatory_gaps ?? 0),
      acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
    }));
    return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    const message = cause instanceof N8nRequestError && cause.status === 404
      ? "The opportunities workflow is not published yet."
      : "Could not load opportunities.";
    return Response.json({ error: message }, { status: 502 });
  }
}
