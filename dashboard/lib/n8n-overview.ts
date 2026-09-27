import type { DashboardData, Evidence, Lead, LeadStage, RequirementMatch } from "./types";

type RecordValue = Record<string, unknown>;

function object(value: unknown): RecordValue {
  if (typeof value === "string") {
    try { return object(JSON.parse(value)); } catch { return {}; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}

function array(value: unknown): unknown[] {
  if (typeof value === "string") {
    try { return array(JSON.parse(value)); } catch { return []; }
  }
  return Array.isArray(value) ? value : [];
}

function string(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function score(value: unknown): number | null {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n > 0 && n <= 1 ? n * 100 : n)));
}

function stage(value: unknown): LeadStage {
  return ["detected", "researched", "matched", "proposal_ready", "failed"].includes(String(value)) ? value as LeadStage : "detected";
}

function date(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function mapLead(value: unknown): Lead {
  const row = object(value);
  const extracted = object(row.extracted);
  const raw = object(row.raw_payload);
  const source = string(row.source, "Unknown source");
  const requirements: RequirementMatch[] = array(extracted.requirements).map((item, index) => {
    const req = object(item);
    return {
      id: string(req.id, `R-${String(index + 1).padStart(2, "0")}`),
      label: typeof item === "string" ? item : string(req.label ?? req.text ?? req.description, "Requirement"),
      mandatory: req.mandatory !== false,
      status: "unknown",
      evidenceIds: [],
      note: "Review the matched source documents for support.",
    };
  });
  const evidence: Evidence[] = array(row.matches).map((item, index) => {
    const match = object(item);
    const payload = object(match.payload);
    const assetRef = string(match.asset_ref ?? payload.document_id);
    return {
      id: String(match.id ?? `match-${index}`),
      title: string(payload.title, assetRef || "Matched document"),
      source: string(payload.asset_type ?? match.asset_type, "Internal knowledge"),
      excerpt: string(payload.text, "Matched source document; review before using this claim.").slice(0, 500),
      retrievedAt: date(row.updated_at) ?? new Date(0).toISOString(),
      assetRef: assetRef || undefined,
    };
  });
  const organization = string(extracted.organization ?? extracted.buyer ?? extracted.client ?? raw.organization, "Organization pending");
  const tags = array(extracted.tags).filter((item): item is string => typeof item === "string").slice(0, 8);
  const status = stage(row.status);
  return {
    id: String(row.id ?? ""),
    title: string(row.title, "Untitled tender"),
    organization,
    sector: string(row.sector ?? extracted.sector, "Unclassified"),
    location: string(extracted.location, "Location pending"),
    summary: string(extracted.summary ?? raw.summary, "Tender details are being processed."),
    stage: status,
    score: score(row.relevance_score),
    coverage: null,
    deadline: date(row.deadline),
    detectedAt: date(row.created_at) ?? new Date(0).toISOString(),
    tags,
    requirements,
    evidence,
    artifacts: [],
    priority: "Medium",
    source,
  };
}

export function mapLeadsResponse(value: unknown): DashboardData {
  const result = object(value);
  if (!Array.isArray(result.items)) throw new Error("Unexpected n8n leads response.");
  return { leads: result.items.map(mapLead).filter((lead) => lead.id), jobs: [] };
}
