"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CircleAlert, RefreshCcw } from "lucide-react";
import type { Lead } from "@/lib/types";

export type DiscoveryItem = {
  id: string;
  title: string;
  organization: string;
  summary: string;
  requirements?: string[];
  url: string;
  source: string;
  publishedAt: string | null;
  deadline?: string | null;
  status?: "needs_review" | "queued" | "expired";
  leadId?: string | null;
  fitScore?: number | null;
  assessment?: string;
  mandatoryGaps?: number;
  acceptedAt?: string | null;
};

function assessmentText(item: DiscoveryItem) {
  if (item.status === "expired") return "Deadline passed";
  if (item.status === "needs_review") return "Source needs review";
  if (item.assessment === "matches_profile") return "Matches our profile";
  if (item.assessment === "low_fit") return "Low profile fit";
  if (item.assessment === "review_required") return "Review requirement gaps";
  return item.leadId ? "Assessing profile" : "Awaiting intake";
}

export default function Discovery({ password, live, demoLeads, onSelect, onOpen }: {
  password: string;
  live: boolean;
  demoLeads: Lead[];
  onSelect: (item: DiscoveryItem) => void;
  onOpen: (id: string) => void;
}) {
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!live) return;
    const controller = new AbortController();
    async function load() {
      setBusy(true); setError("");
      try {
        const response = await fetch("/api/opportunities", {
          headers: { "x-olivesoft-upload-password": password },
          cache: "no-store", signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load opportunities.");
        if (!Array.isArray(result.items)) throw new Error("Invalid opportunities response.");
        setItems(result.items.filter((item: DiscoveryItem) => item && typeof item.title === "string" && /^https:\/\//.test(item.url)));
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load opportunities.");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [password, live, refresh]);

  const shown = live ? items : demoLeads.map((lead) => ({
    id: lead.id, title: lead.title, organization: lead.organization,
    summary: lead.summary, url: lead.sourceUrl ?? "", source: lead.source,
    requirements: lead.requirements.map((requirement) => requirement.label),
    publishedAt: lead.detectedAt, deadline: lead.deadline, status: "queued" as const,
    leadId: lead.id, fitScore: lead.score, assessment: lead.assessment ?? (lead.score === null ? "insufficient_evidence" : "review_required"),
    mandatoryGaps: lead.requirements.filter((requirement) => requirement.mandatory && ["unknown", "unsupported"].includes(requirement.status)).length,
    acceptedAt: lead.acceptedAt,
  }));

  return <div className="view-enter discovery-view">
    <div className="page-heading"><div><div className="overline"><span className="overline-pulse" /> AUTOMATIC DISCOVERY</div><h1>Opportunities<span className="heading-dot">.</span></h1><p>New notices are collected automatically. Review their evidence and choose which ones to pursue.</p></div><button className="secondary-button" disabled={busy} onClick={() => setRefresh((value) => value + 1)}><RefreshCcw size={16} /> Refresh list</button></div>
    {busy && <div className="panel discovery-empty">Loading saved opportunities…</div>}
    {error && <p className="knowledge-form-error" role="alert">{error}</p>}
    {!busy && !error && <p className="discovery-count">{shown.length} saved opportunit{shown.length === 1 ? "y" : "ies"}{live ? " from scheduled discovery" : " in the demo workspace"}.</p>}
    {!busy && !error && shown.length === 0 && <div className="panel discovery-empty">No opportunities have been discovered yet. The scheduled n8n scan will add new notices here.</div>}
    <div className="discovery-results">{shown.map((item) => <article className="panel discovery-card" key={item.id}><div><span className="eyebrow">{item.source.toUpperCase()}{item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleDateString()}` : ""}{item.deadline ? ` · Due ${new Date(item.deadline).toLocaleDateString()}` : ""}</span><h2>{item.title}</h2><p className="discovery-org">{item.organization}</p><p>{item.summary}</p><p><strong>{item.fitScore === null || item.fitScore === undefined ? "Fit pending" : `${item.fitScore}% profile fit`}</strong> · {assessmentText(item)}{item.mandatoryGaps ? ` · ${item.mandatoryGaps} mandatory gap${item.mandatoryGaps === 1 ? "" : "s"}` : ""}{item.acceptedAt ? " · Accepted" : ""}</p>{item.status === "needs_review" && <p><CircleAlert size={15} /> The source lacks enough verified detail for automatic assessment.</p>}</div><div className="discovery-card-actions">{/^https:\/\//.test(item.url) && <a className="secondary-button compact" href={item.url} target="_blank" rel="noopener noreferrer">Open source <ArrowUpRight size={16} /></a>}{item.leadId ? <button className="primary-button" onClick={() => onOpen(item.leadId!)}>Review fit <ArrowUpRight size={16} /></button> : item.status === "needs_review" ? <button className="primary-button" onClick={() => onSelect(item)}>Complete details <ArrowUpRight size={16} /></button> : null}</div></article>)}</div>
  </div>;
}
