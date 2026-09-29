"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bell, BookOpen, Check, CheckCheck,
  ChevronRight, CircleAlert, CircleCheck, Clock3, Command, Download,
  ExternalLink, FileDown, FilePlus2, FileText, FolderOpen, Gauge, LayoutDashboard,
  Menu, MoreHorizontal, Plus, Radar, RefreshCcw, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, TrendingUp, X,
} from "lucide-react";
import { createLead } from "@/lib/demo-data";
import { demoAdapter, resetDemo } from "@/lib/adapter";
import type { DashboardData, Job, Lead, LeadStage, MatchStatus } from "@/lib/types";
import Knowledge from "@/components/Knowledge";
import Discovery, { type DiscoveryItem } from "@/components/Discovery";

type View = "overview" | "discover" | "pipeline" | "lead" | "knowledge" | "proposals" | "activity";
type TenderInput = { title: string; organization: string; summary: string; deadline: string; source?: "manual" | "ted" | "tavily" | "serpapi"; sourceUrl?: string };
type FilterStage = "all" | LeadStage;

const stageLabels: Record<LeadStage, string> = {
  detected: "Detected", researched: "Researched", matched: "Matched", proposal_ready: "Proposal ready", failed: "Needs attention",
};

const stageOrder: LeadStage[] = ["detected", "researched", "matched", "proposal_ready"];

function shortDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function relativeDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function toneForMatch(status: MatchStatus) {
  return status === "supported" ? "green" : status === "partial" ? "amber" : status === "unsupported" ? "red" : "muted";
}

function StatusPill({ stage }: { stage: LeadStage }) {
  return <span className={`status-pill status-${stage}`}><span className="status-dot" />{stageLabels[stage]}</span>;
}

function MatchPill({ status }: { status: MatchStatus }) {
  return <span className={`match-pill match-${toneForMatch(status)}`}>{status === "unknown" ? "Unknown" : status[0].toUpperCase() + status.slice(1)}</span>;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="section-title"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>;
}

function Sparkline({ values, color = "#16d4cf" }: { values: number[]; color?: string }) {
  const points = values.map((value, index) => `${index * 16},${40 - value * 0.35}`).join(" ");
  return <svg className="sparkline" viewBox="0 0 112 42" aria-hidden="true"><polyline fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" points={points} /></svg>;
}

function TrendChart({ counts, onMonth }: { counts: number[]; onMonth: (month: number) => void }) {
  const peak = Math.max(1, ...counts);
  return <div className="trend-chart">
    <div className="chart-grid"><span>{peak}</span><span>{Math.ceil(peak * .75)}</span><span>{Math.ceil(peak * .5)}</span><span>{Math.ceil(peak * .25)}</span></div>
    <div className="chart-bars">{counts.map((count, index) => <button className="chart-column" key={index} onClick={() => onMonth(index)} aria-label={`View ${new Date(new Date().getFullYear(), index).toLocaleString("en-US", { month: "long" })} tenders: ${count}`}><span className="chart-bar" style={{ height: `${Math.max(count ? 10 : 2, count / peak * 100)}%`, animationDelay: `${index * 55}ms` }}><span className="chart-tooltip">{count} tender{count === 1 ? "" : "s"}</span></span></button>)}</div>
    <div className="chart-months"><span>Jan</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span><span>Nov</span></div>
  </div>;
}

function PipelineGraphic({ leads, onStage }: { leads: Lead[]; onStage: (stage: LeadStage) => void }) {
  const counts = stageOrder.map((stage) => leads.filter((lead) => lead.stage === stage).length);
  const icons = [Radar, Search, CheckCheck, FileText];
  return <div className="pipeline-graphic">
    <div className="pipeline-track" aria-hidden="true"><div className="pipeline-track-fill" /></div>
    {stageOrder.map((stage, index) => {
      const Icon = icons[index];
      return <button className="pipeline-step" key={stage} onClick={() => onStage(stage)} aria-label={`View ${stageLabels[stage]} tenders`}><span className={`pipeline-orb orb-${index}`}><Icon size={20} strokeWidth={1.9} /></span><span className="pipeline-number">{counts[index].toString().padStart(2, "0")}</span><span className="pipeline-label">{stageLabels[stage]}</span></button>;
    })}
  </div>;
}

function LeadTable({ leads, onOpen, compact = false }: { leads: Lead[]; onOpen: (id: string) => void; compact?: boolean }) {
  if (!leads.length) return <div className="empty-state"><Search size={26} /><strong>No tenders found</strong><span>Try a different search or filter.</span></div>;
  return <div className="table-scroll"><table className="leads-table"><thead><tr><th>OPPORTUNITY</th><th>STATUS</th><th>FIT SCORE</th><th>DEADLINE</th>{!compact && <th>PRIORITY</th>}<th aria-label="Open" /></tr></thead><tbody>{leads.map((lead, index) => <tr key={lead.id} onClick={() => onOpen(lead.id)} style={{ animationDelay: `${index * 35}ms` }} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(lead.id); } }}><td><div className="lead-cell"><span className={`org-avatar avatar-${index % 5}`}>{initials(lead.organization)}</span><div><strong>{lead.title}</strong><small>{lead.organization} <span className="cell-separator">·</span> {lead.id}</small></div></div></td><td><StatusPill stage={lead.stage} /></td><td>{lead.score === null ? <span className="muted-value">—</span> : <div className="score-cell"><strong>{lead.score}%</strong><span className="score-track"><span style={{ width: `${lead.score}%` }} /></span></div>}</td><td><span className="date-cell">{shortDate(lead.deadline)}</span></td>{!compact && <td><span className={`priority priority-${lead.priority.toLowerCase()}`}><span />{lead.priority}</span></td>}<td><ChevronRight size={17} className="row-chevron" /></td></tr>)}</tbody></table></div>;
}

function StatCard({ icon, label, value, detail, tint, spark, onClick }: { icon: ReactNode; label: string; value: string; detail: string; tint: string; spark: number[]; onClick: () => void }) {
  return <button className="stat-card stat-card-button" onClick={onClick}><div className="stat-top"><span className={`stat-icon tint-${tint}`}>{icon}</span></div><div className="stat-label">{label}</div><div className="stat-bottom"><div><strong className="stat-value">{value}</strong><span className="stat-change">{detail}</span></div><Sparkline values={spark} color={tint === "purple" ? "#25d9ca" : tint === "orange" ? "#f1ad71" : tint === "green" ? "#56d8b1" : "#29bce0"} /></div></button>;
}

function NewTenderModal({ onClose, onCreate, live, discovery }: { onClose: () => void; onCreate: (input: TenderInput) => Promise<void> | void; live: boolean; discovery?: DiscoveryItem | null }) {
  const [form, setForm] = useState<TenderInput>({ title: discovery?.title.slice(0, 100) ?? "", organization: discovery?.organization === "Review source" ? "" : discovery?.organization.slice(0, 80) ?? "", summary: discovery?.summary.slice(0, 700) ?? "", deadline: "", source: discovery?.source.toLowerCase() as "ted" | "tavily" | "serpapi" | undefined, sourceUrl: discovery?.url });
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>("button, input, textarea, select, a[href]")).filter((element) => !element.hasAttribute("disabled"));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || !dialog.contains(active))) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); previouslyFocused?.focus(); };
  }, []);
  const [touched, setTouched] = useState({ title: false, organization: false, summary: false });
  const invalidTitle = form.title.trim().length < 4;
  const invalidOrganization = form.organization.trim().length < 2;
  const invalidSummary = form.summary.trim().length < 12;
  const valid = !invalidTitle && !invalidOrganization && !invalidSummary;
  const trimNotes = discovery ? [
    discovery.title.length > 100 ? `title trimmed to 100/${discovery.title.length} characters` : "",
    discovery.organization.length > 80 ? `organization trimmed to 80/${discovery.organization.length} characters` : "",
    discovery.summary.length > 700 ? `summary trimmed to 700/${discovery.summary.length} characters` : "",
  ].filter(Boolean).join(" · ") : "";
  async function submit(event: FormEvent) { event.preventDefault(); if (!valid || submitting) return; setSubmitting(true); try { await onCreate(form); } finally { setSubmitting(false); } }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialogRef}><div className="modal-heading"><div><span className="eyebrow">{live ? "LIVE INTAKE" : "DEMO INTAKE"}</span><h2 id="modal-title">Add a new tender</h2><p>{discovery ? "Check the source and correct these fields before submitting." : live ? "Submit this tender to the n8n intake workflow." : "Create a local demo opportunity. It will not be sent to n8n."}</p>{trimNotes && <p className="field-note">{trimNotes}</p>}{discovery && <a href={discovery.url} target="_blank" rel="noopener noreferrer">Open original notice ↗</a>}</div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div><form onSubmit={submit}><label>Opportunity title<input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} onBlur={() => setTouched((current) => ({ ...current, title: true }))} placeholder="e.g. Digital Infrastructure Program" maxLength={100} required aria-invalid={touched.title && invalidTitle} aria-describedby={touched.title && invalidTitle ? "tender-title-hint" : undefined} />{touched.title && invalidTitle && <span id="tender-title-hint" className="field-hint">At least 4 characters</span>}</label><div className="modal-grid"><label>Organization<input value={form.organization} onChange={(event) => setForm({ ...form, organization: event.target.value })} onBlur={() => setTouched((current) => ({ ...current, organization: true }))} placeholder="Organization name" maxLength={80} required aria-invalid={touched.organization && invalidOrganization} aria-describedby={touched.organization && invalidOrganization ? "tender-organization-hint" : undefined} />{touched.organization && invalidOrganization && <span id="tender-organization-hint" className="field-hint">At least 2 characters</span>}</label><label>Deadline<input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} aria-describedby="tender-deadline-hint" /><span id="tender-deadline-hint" className="field-hint">Optional</span></label></div><label>Brief summary<textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} onBlur={() => setTouched((current) => ({ ...current, summary: true }))} placeholder="What is the organization looking to achieve?" rows={4} maxLength={700} required aria-invalid={touched.summary && invalidSummary} aria-describedby={touched.summary && invalidSummary ? "tender-summary-hint" : undefined} />{touched.summary && invalidSummary && <span id="tender-summary-hint" className="field-hint">At least 12 characters</span>}</label><div className="modal-footer"><span><ShieldCheck size={15} /> {live ? "Sent securely through the dashboard server" : "Stored in this browser only"}</span><button type="submit" className="primary-button" disabled={!valid || submitting}><Plus size={17} /> {submitting ? "Submitting..." : "Create tender"}</button></div></form></div></div>;
}

function ProposalPreview({ lead, onDownload }: { lead: Lead; onDownload: (kind: "pdf" | "pptx") => void }) {
  return <div className="proposal-preview"><div className="preview-slide"><div className="preview-topline"><span className="brand-mark small"><span /></span><span>OLIVESOFT / DEMO PROPOSAL</span></div><div className="preview-shape shape-one" /><div className="preview-shape shape-two" /><div className="preview-slide-content"><span className="preview-kicker">A STRATEGIC RESPONSE FOR</span><h3>{lead.organization}</h3><p>{lead.title}</p><span className="preview-line" /><small>Prepared with evidence-linked insights · Demo preview</small></div><div className="preview-page">01 / 08</div></div><div className="preview-actions"><div><strong>Proposal preview</strong><span>Illustrative cover slide · {lead.artifacts.length ? "demo files available" : "generation required"}</span></div><div className="preview-buttons"><button className="secondary-button compact" disabled={!lead.artifacts.length} onClick={() => onDownload("pdf")}><Download size={15} /> PDF</button><button className="secondary-button compact" disabled={!lead.artifacts.length} onClick={() => onDownload("pptx")}><Download size={15} /> PPTX</button></div></div></div>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [view, setView] = useState<View>("overview");
  const [selectedId, setSelectedId] = useState<string>("OS-2026-041");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStage>("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedDiscovery, setSelectedDiscovery] = useState<DiscoveryItem | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [focusSearch, setFocusSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "requirements" | "evidence">("overview");
  const [integration, setIntegration] = useState<"checking" | "demo" | "locked" | "live">("checking");
  const [workspacePassword, setWorkspacePassword] = useState("");
  const [accessError, setAccessError] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const [monthFilter, setMonthFilter] = useState<number | null>(null);
  const [sortByFit, setSortByFit] = useState(false);

  useEffect(() => {
    fetch("/api/knowledge/status", { cache: "no-store" }).then((response) => response.json()).then((status) => {
      if (status.configured === true) setIntegration("locked");
      else { setIntegration("demo"); void demoAdapter.load().then(setData); }
    }).catch(() => { setIntegration("locked"); setAccessError("Could not check the live connection. Try again shortly."); });
  }, []);
  useEffect(() => { if (data && integration === "demo") void demoAdapter.save(data); }, [data, integration]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 3500); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (integration !== "demo" || !data?.jobs.some((job) => job.state === "running" && job.operation === "proposal")) return;
    const timer = window.setInterval(() => setData((current) => {
      if (!current) return current;
      let changed = false;
      const completedIds: string[] = [];
      const jobs = current.jobs.map((job) => {
        if (job.state !== "running" || job.operation !== "proposal") return job;
        changed = true;
        const progress = Math.min(100, job.progress + 13);
        if (progress === 100) completedIds.push(job.leadId);
        const stage = progress < 35 ? "Assembling evidence" : progress < 70 ? "Composing slides" : progress < 100 ? "Exporting sample files" : "Demo proposal ready";
        return { ...job, progress, stage, state: progress === 100 ? "completed" as const : "running" as const };
      });
      if (!changed) return current;
      const leads = current.leads.map((lead) => completedIds.includes(lead.id) ? { ...lead, stage: "proposal_ready" as const, artifacts: [{ id: `demo-pptx-${lead.id}`, kind: "pptx" as const, name: `${lead.organization.replace(/\W+/g, "_")}_Proposal_DEMO.pptx`, demo: true as const }, { id: `demo-pdf-${lead.id}`, kind: "pdf" as const, name: `${lead.organization.replace(/\W+/g, "_")}_Proposal_DEMO.pdf`, demo: true as const }] } : lead);
      return { leads, jobs };
    }), 850);
    return () => window.clearInterval(timer);
  }, [data?.jobs, integration]);

  const leads = data?.leads ?? [];
  const jobs = data?.jobs ?? [];
  const selected = leads.find((lead) => lead.id === selectedId) ?? leads[0];
  const filtered = useMemo(() => leads.filter((lead) => {
    const text = `${lead.title} ${lead.organization} ${lead.tags.join(" ")} ${lead.id}`.toLowerCase();
    const date = new Date(lead.detectedAt);
    return text.includes(search.toLowerCase()) && (filter === "all" || lead.stage === filter) && (monthFilter === null || (date.getFullYear() === new Date().getFullYear() && date.getMonth() === monthFilter));
  }).sort((a, b) => sortByFit ? (b.score ?? -1) - (a.score ?? -1) : new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()), [leads, search, filter, monthFilter, sortByFit]);
  const readyCount = leads.filter((lead) => lead.stage === "proposal_ready").length;
  const matchedCount = leads.filter((lead) => lead.stage === "matched").length;
  const avgFit = leads.filter((lead) => lead.score !== null).reduce((sum, lead, _, all) => sum + (lead.score ?? 0) / all.length, 0);
  const currentYear = new Date().getFullYear();
  const monthCounts = Array.from({ length: 12 }, (_, month) => leads.filter((lead) => { const date = new Date(lead.detectedAt); return date.getFullYear() === currentYear && date.getMonth() === month; }).length);

  async function liveFetch(path = "/api/overview", init: RequestInit = {}) {
    const response = await fetch(path, { ...init, headers: { "x-olivesoft-upload-password": workspacePassword, ...init.headers }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "n8n request failed.");
    return result;
  }
  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (!workspacePassword || accessBusy) return;
    setAccessBusy(true); setAccessError("");
    try { const result = await liveFetch(); setData(result as DashboardData); setIntegration("live"); }
    catch (cause) { setAccessError(cause instanceof Error ? cause.message : "Could not open workspace."); }
    finally { setAccessBusy(false); }
  }
  async function refreshLive() {
    if (integration !== "live") return;
    try { const result = await liveFetch(); setData(result as DashboardData); setToast({ message: "Live tenders refreshed", tone: "success" }); }
    catch (cause) { setToast({ message: cause instanceof Error ? cause.message : "Refresh failed.", tone: "error" }); }
  }
  function navigate(next: View) { setView(next); setMobileNav(false); setSearch(""); setFilter("all"); setMonthFilter(null); setSortByFit(false); }
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); navigateRef.current("pipeline"); setFocusSearch(true); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => { if (!focusSearch || view !== "pipeline") return; searchInputRef.current?.focus(); setFocusSearch(false); }, [focusSearch, view]);
  function openStage(stage: LeadStage) { navigate("pipeline"); setFilter(stage); }
  function openMonth(month: number) { navigate("pipeline"); setMonthFilter(month); }
  async function openLead(id: string) {
    setSelectedId(id); setDetailTab("overview"); navigate("lead");
    if (integration === "live") {
      try { const result = await liveFetch(`/api/overview?id=${encodeURIComponent(id)}`); setData((current) => current ? { ...current, leads: current.leads.map((lead) => lead.id === id ? result.lead as Lead : lead) } : current); }
      catch (cause) { setToast({ message: cause instanceof Error ? cause.message : "Could not load tender details.", tone: "error" }); }
    }
  }
  async function createTender(input: TenderInput) {
    if (integration === "live") {
      try {
        const result = await liveFetch("/api/tenders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
        setShowModal(false); setSelectedDiscovery(null);
        const latest = await liveFetch();
        setData(latest as DashboardData);
        setToast({ message: "Tender submitted to n8n", tone: "success" });
        if (result.leadId) void openLead(String(result.leadId));
      } catch (cause) { setToast({ message: cause instanceof Error ? cause.message : "Tender intake failed.", tone: "error" }); }
      return;
    }
    const lead = createLead(input);
    const job: Job = { id: `JOB-DEMO-${Date.now().toString(36).toUpperCase()}`, leadId: lead.id, operation: "intake", state: "completed", stage: "Demo intake recorded", progress: 100, createdAt: new Date().toISOString() };
    setData((current) => current ? { leads: [lead, ...current.leads], jobs: [job, ...current.jobs] } : current);
    setShowModal(false); setSelectedDiscovery(null); setToast({ message: "Tender added to your demo workspace", tone: "success" }); openLead(lead.id);
  }
  function generateProposal(lead: Lead) {
    if (integration === "live") { setToast({ message: "Live proposal generation is awaiting a verified n8n export workflow.", tone: "error" }); return; }
    if (lead.stage !== "matched") return;
    if (jobs.some((job) => job.leadId === lead.id && job.operation === "proposal" && job.state === "running")) return;
    const job: Job = { id: `JOB-DEMO-${Date.now().toString(36).toUpperCase()}`, leadId: lead.id, operation: "proposal", state: "running", stage: "Assembling evidence", progress: 8, createdAt: new Date().toISOString() };
    setData((current) => current ? { ...current, jobs: [job, ...current.jobs] } : current);
    setToast({ message: "Demo proposal generation started", tone: "success" });
  }
  function retryLead(lead: Lead) {
    if (integration === "live") { setToast({ message: "Live retry is not connected yet.", tone: "error" }); return; }
    if (lead.stage !== "failed") return;
    setData((current) => current ? { leads: current.leads.map((item) => item.id === lead.id ? { ...item, stage: "detected" } : item), jobs: [{ id: `JOB-DEMO-${Date.now().toString(36).toUpperCase()}`, leadId: lead.id, operation: "retry", state: "completed", stage: "Reset to detected for review", progress: 100, createdAt: new Date().toISOString() }, ...current.jobs] } : current);
    setToast({ message: "Tender reset to Detected for review", tone: "success" });
  }
  function downloadDemo(kind: "pdf" | "pptx") {
    const anchor = document.createElement("a");
    anchor.href = `/demo/OliveSoft_Proposal_DEMO.${kind}`;
    anchor.download = `OliveSoft_Proposal_DEMO.${kind}`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setToast({ message: `Downloading sample ${kind.toUpperCase()} · Demo file`, tone: "success" });
  }
  async function reset() { if (integration === "live") { await refreshLive(); return; } const fresh = await resetDemo(); setData(fresh); setSelectedId("OS-2026-041"); navigate("overview"); setToast({ message: "Demo workspace restored", tone: "success" }); }

  if (integration === "locked") return <div className="workspace-lock"><div className="workspace-lock-card"><span className="brand-mark"><span /></span><span className="eyebrow">OLIVESOFT LIVE WORKSPACE</span><h1>Open the command center.</h1><p>Enter the team password to load live tenders from n8n.</p><form onSubmit={unlock}><label htmlFor="workspace-password">Team password</label><input id="workspace-password" type="password" autoFocus value={workspacePassword} onChange={(event) => setWorkspacePassword(event.target.value)} autoComplete="current-password" />{accessError && <span className="knowledge-form-error" role="alert">{accessError}</span>}<button className="primary-button" disabled={!workspacePassword || accessBusy}>{accessBusy ? "Connecting..." : "Open workspace"} <ArrowRight size={17} /></button></form></div></div>;
  if (!data) return <div className="loading-screen"><div className="loading-brand"><span className="brand-mark"><span /></span> OliveSoft</div><span className="loading-ring" /><p>Opening intelligence workspace...</p></div>;

  const navItems: { id: View; label: string; icon: ReactNode; badge?: string }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard size={19} /> },
    { id: "discover", label: "Find tenders", icon: <Search size={19} /> },
    { id: "pipeline", label: "Tender pipeline", icon: <Radar size={19} />, badge: String(leads.length) },
    { id: "knowledge", label: "Knowledge base", icon: <BookOpen size={19} /> },
    { id: "proposals", label: "Proposals", icon: <FolderOpen size={19} /> },
    { id: "activity", label: "Activity", icon: <Activity size={19} /> },
  ];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="sidebar-top"><button className="brand" onClick={() => navigate("overview")}><span className="brand-mark"><span /></span><span>Olive<span className="brand-strong">Soft</span><small>INTELLIGENCE</small></span></button><button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={19} /></button></div>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">{navItems.map((item) => <button key={item.id} className={`nav-item ${view === item.id || (view === "lead" && item.id === "pipeline") ? "active" : ""}`} onClick={() => navigate(item.id)}>{item.icon}<span>{item.label}</span>{item.badge && <small>{item.badge}</small>}</button>)}</nav>
      <div className="sidebar-spacer" />
    </aside>
    {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close menu" />}
    <div className="main-area"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={21} /></button><span className="breadcrumb">Workspace <ChevronRight size={14} /> <strong>{view === "lead" ? selected?.organization : view === "pipeline" ? "Tender pipeline" : view === "knowledge" ? "Knowledge base" : view[0].toUpperCase() + view.slice(1)}</strong></span></div><div className="topbar-right"><span className="demo-chip"><span /> {integration === "live" ? "LIVE N8N" : "DEMO MODE"}</span><button className="header-search" onClick={() => { navigate("pipeline"); setFocusSearch(true); }} aria-label="Search opportunities"><Search size={17} /><span>Search opportunities</span><kbd>⌘ K</kbd></button><button className="top-icon" onClick={() => navigate("activity")} aria-label="Activity"><Bell size={19} />{jobs.some((job) => job.state === "running") && <span />}</button></div></header>
      <main className="content">
        {view === "overview" && <div className="view-enter">
          <div className="page-heading"><div><div className="overline"><span className="overline-pulse" /> INTELLIGENCE WORKSPACE <span className="overline-slash">/</span> {integration === "live" ? "LIVE OVERVIEW" : "DEMO OVERVIEW"}</div><h1>Command center<span className="heading-dot">.</span></h1><p>A clearer view of every opportunity, from first signal to final proposal.</p></div><div className="overview-heading-actions">{integration === "live" && <button className="secondary-button" onClick={() => void refreshLive()}><RefreshCcw size={16} /> Refresh</button>}<button className="primary-button" onClick={() => setShowModal(true)}><Plus size={18} /> Add new tender</button></div></div>
          <div className="stats-grid"><StatCard icon={<Radar size={21} />} label="Total opportunities" value={String(leads.length).padStart(2, "0")} detail="View all tenders" tint="blue" spark={monthCounts.slice(-8)} onClick={() => navigate("pipeline")} /><StatCard icon={<Gauge size={21} />} label="Average fit score" value={leads.some((lead) => lead.score !== null) ? `${Math.round(avgFit)}%` : "—"} detail="View highest fit" tint="purple" spark={monthCounts.slice(-8)} onClick={() => { navigate("pipeline"); setSortByFit(true); }} /><StatCard icon={<CheckCheck size={21} />} label="Matched opportunities" value={String(matchedCount).padStart(2, "0")} detail="Open matched tenders" tint="green" spark={monthCounts.slice(-8)} onClick={() => openStage("matched")} /><StatCard icon={<FileText size={21} />} label="Proposals ready" value={String(readyCount).padStart(2, "0")} detail="Open ready tenders" tint="orange" spark={monthCounts.slice(-8)} onClick={() => openStage("proposal_ready")} /></div>
          <div className="overview-grid"><div className="panel trend-panel"><SectionTitle eyebrow="PERFORMANCE" title="Opportunity momentum" action={<button className="time-select" onClick={() => navigate("pipeline")}>{currentYear} <ArrowUpRight size={13} /></button>} /><div className="chart-summary"><strong>{monthCounts.reduce((sum, count) => sum + count, 0)}</strong><span><TrendingUp size={15} /> tenders detected this year</span></div><TrendChart counts={monthCounts} onMonth={openMonth} /></div><div className="panel pipeline-panel"><SectionTitle eyebrow="WORKFLOW" title="Your pipeline" action={<button className="text-link" onClick={() => navigate("pipeline")}>View all <ArrowUpRight size={15} /></button>} /><p className="panel-description">A real-time view of where each opportunity stands.</p><PipelineGraphic leads={leads} onStage={openStage} /><div className="pipeline-foot"><span><span className="tiny-dot green" /> {readyCount} proposals ready</span><span><span className="tiny-dot amber" /> {matchedCount} awaiting action</span></div></div></div>
          <div className="panel table-panel"><SectionTitle eyebrow="TOP OPPORTUNITIES" title="Recent tenders" action={<button className="text-link" onClick={() => navigate("pipeline")}>View pipeline <ArrowRight size={15} /></button>} /><LeadTable leads={leads.slice(0, 5)} onOpen={openLead} compact /></div>
        </div>}
        {view === "knowledge" && <Knowledge initialPassword={integration === "live" ? workspacePassword : ""} />}
        {view === "discover" && <Discovery password={workspacePassword} live={integration === "live"} onSelect={(item) => { setSelectedDiscovery(item); setShowModal(true); }} />}
        {view === "pipeline" && <div className="view-enter"><div className="page-heading"><div><div className="overline"><span className="overline-pulse" /> OPPORTUNITY INTELLIGENCE</div><h1>Tender pipeline<span className="heading-dot">.</span></h1><p>Track every opportunity and focus on the bids that matter most.</p></div><button className="primary-button" onClick={() => setShowModal(true)}><Plus size={18} /> Add new tender</button></div><div className="pipeline-summary"><div><span>ALL OPPORTUNITIES</span><strong>{leads.length.toString().padStart(2, "0")}</strong></div><div><span>IN RESEARCH</span><strong>{leads.filter((lead) => lead.stage === "researched").length.toString().padStart(2, "0")}</strong></div><div><span>READY TO PROPOSE</span><strong>{matchedCount.toString().padStart(2, "0")}</strong></div><div><span>PROPOSALS READY</span><strong>{readyCount.toString().padStart(2, "0")}</strong></div></div><div className="panel pipeline-list-panel"><div className="list-toolbar"><div className="list-title"><span className="eyebrow">PIPELINE BOARD</span><h2>All opportunities <span>{filtered.length}</span></h2></div><div className="list-controls"><div className="search-field"><Search size={17} /><input ref={searchInputRef} aria-label="Search opportunities" placeholder="Search opportunities..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><button className="sort-toggle" aria-pressed={sortByFit} onClick={() => setSortByFit((current) => !current)}>Sort: {sortByFit ? "Fit" : "Recent"}</button></div></div>{(monthFilter !== null || filter !== "all" || search !== "" || sortByFit) && <div className="filter-chips">{monthFilter !== null && <span className="filter-chip">{new Date(currentYear, monthFilter).toLocaleString("en-US", { month: "short" })} {currentYear}<button onClick={() => setMonthFilter(null)} aria-label="Clear month filter"><X size={16} /></button></span>}{filter !== "all" && <span className="filter-chip">{stageLabels[filter]}<button onClick={() => setFilter("all")} aria-label="Clear stage filter"><X size={16} /></button></span>}{search !== "" && <span className="filter-chip">search: {search}<button onClick={() => setSearch("")} aria-label="Clear search"><X size={16} /></button></span>}{sortByFit && <span className="filter-chip">Sorted by fit<button onClick={() => setSortByFit(false)} aria-label="Clear sort"><X size={16} /></button></span>}<button className="filter-chip-clear" onClick={() => { setMonthFilter(null); setFilter("all"); setSearch(""); setSortByFit(false); }}>Clear all</button></div>}<div className="filter-tabs">{(["all", "detected", "researched", "matched", "proposal_ready", "failed"] as FilterStage[]).map((stage) => <button key={stage} className={filter === stage ? "selected" : ""} onClick={() => setFilter(stage)}>{stage === "all" ? "All tenders" : stageLabels[stage]}<span>{stage === "all" ? leads.length : leads.filter((lead) => lead.stage === stage).length}</span></button>)}</div><LeadTable leads={filtered} onOpen={openLead} /></div></div>}
        {view === "lead" && selected && <div className="view-enter"><button className="back-link" onClick={() => navigate("pipeline")}><ArrowLeft size={16} /> Back to pipeline</button><div className="detail-head"><div><div className="detail-kicker"><span>{selected.id}</span><span className="detail-divider">/</span><span>{selected.sector}</span></div><h1>{selected.title}<span className="heading-dot">.</span></h1><p>{selected.organization} <span>·</span> {selected.location}</p></div><div className="detail-actions"><StatusPill stage={selected.stage} />{selected.stage === "matched" && <button className="primary-button" onClick={() => generateProposal(selected)} disabled={jobs.some((job) => job.leadId === selected.id && job.operation === "proposal" && job.state === "running")}><Sparkles size={17} /> Generate proposal</button>}{selected.stage === "failed" && <button className="primary-button" onClick={() => retryLead(selected)}><RefreshCcw size={17} /> Retry intake</button>}{selected.stage === "proposal_ready" && <button className="primary-button" onClick={() => { navigate("proposals"); setSelectedId(selected.id); }}><FileText size={17} /> View proposal</button>}</div></div><div className="detail-metrics"><div><span>FIT SCORE</span><strong>{selected.score === null ? "—" : `${selected.score}%`}</strong><small>Relevance rubric</small></div><div><span>REQUIREMENT COVERAGE</span><strong>{selected.coverage === null ? "—" : `${selected.coverage}%`}</strong><small>Evidence-linked support</small></div><div><span>SUBMISSION DEADLINE</span><strong>{shortDate(selected.deadline)}</strong><small>{selected.deadline ? new Date(selected.deadline).getFullYear() : "Not provided"}</small></div><div><span>PRIORITY</span><strong>{selected.priority}</strong><small>Bid team review</small></div></div><div className="detail-grid"><div className="detail-main"><div className="detail-tabs"><button className={detailTab === "overview" ? "active" : ""} onClick={() => setDetailTab("overview")}>Overview</button><button className={detailTab === "requirements" ? "active" : ""} onClick={() => setDetailTab("requirements")}>Requirements <span>{selected.requirements.length}</span></button><button className={detailTab === "evidence" ? "active" : ""} onClick={() => setDetailTab("evidence")}>Evidence <span>{selected.evidence.length}</span></button></div>{detailTab === "overview" && <><div className="panel detail-panel"><SectionTitle eyebrow="OPPORTUNITY BRIEF" title="What this tender needs" /><p className="summary-text">{selected.summary}</p><div className="tag-list">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div><div className="panel detail-panel"><SectionTitle eyebrow="INTELLIGENCE" title="Requirement coverage" action={<button className="text-link" onClick={() => setDetailTab("requirements")}>View matrix <ArrowUpRight size={15} /></button>} />{selected.requirements.length ? <div className="requirement-list">{selected.requirements.slice(0, 4).map((requirement) => <div className="requirement-row" key={requirement.id}><div><span className="req-id">{requirement.id}</span><strong>{requirement.label}</strong></div><MatchPill status={requirement.status} /></div>)}</div> : <div className="inline-empty"><CircleAlert size={20} /> Requirements will appear after n8n detection and matching.</div>}</div></>}{detailTab === "requirements" && <div className="panel detail-panel"><SectionTitle eyebrow="EVIDENCE-LINKED MATRIX" title="Requirement matching" /><p className="panel-description">Demo assessments are illustrative. Candidate availability and unsupported claims require human review.</p>{selected.requirements.length ? <div className="requirements-full">{selected.requirements.map((requirement) => <div className="requirement-card" key={requirement.id}><div className="requirement-card-top"><div><span className="req-id">{requirement.id}{requirement.mandatory && <span className="mandatory">MANDATORY</span>}</span><h3>{requirement.label}</h3></div><MatchPill status={requirement.status} /></div><p>{requirement.note || "Demo evidence assessment. Review sources before making a proposal claim."}</p><span className="evidence-count"><FileText size={14} /> {requirement.evidenceIds.length} linked source{requirement.evidenceIds.length === 1 ? "" : "s"}</span></div>)}</div> : <div className="empty-state"><SlidersHorizontal size={25} /><strong>No matches yet</strong><span>This newly detected tender is awaiting the n8n matching workflow.</span></div>}</div>}{detailTab === "evidence" && <div className="panel detail-panel"><SectionTitle eyebrow="SOURCE RECORD" title="Evidence library" /><p className="panel-description">Every statement should trace back to a source record or internal asset.</p>{selected.evidence.length ? <div className="evidence-list">{selected.evidence.map((item) => <div className="evidence-card" key={item.id}><div className="evidence-icon"><FileText size={19} /></div><div><div className="evidence-title"><strong>{item.title}</strong>{item.assetRef && <span>{item.assetRef}</span>}</div><small>{item.source} · Retrieved {shortDate(item.retrievedAt)}</small><p>“{item.excerpt}”</p></div></div>)}</div> : <div className="empty-state"><FolderOpen size={25} /><strong>No evidence recorded</strong><span>Research has not supplied source material for this tender.</span></div>}</div>}</div><div className="detail-side"><div className="panel side-panel"><span className="eyebrow">WORKFLOW PROGRESS</span><h3>From signal to proposal</h3><div className="stage-list">{stageOrder.map((stage, index) => { const currentIndex = stageOrder.indexOf(selected.stage); const done = currentIndex >= index; return <div key={stage} className={`stage-row ${done ? "done" : ""}`}><span className="stage-icon">{done ? <Check size={15} /> : index + 1}</span><div><strong>{stageLabels[stage]}</strong><small>{["Tender captured", "Prospect context", "Evidence matched", "Documents exported"][index]}</small></div></div>; })}</div></div><div className="panel side-panel source-panel"><span className="eyebrow">SOURCE DETAILS</span><dl><div><dt>Source</dt><dd>{selected.source}</dd></div><div><dt>Detected</dt><dd>{relativeDate(selected.detectedAt)}</dd></div><div><dt>Evidence records</dt><dd>{selected.evidence.length}</dd></div><div><dt>Requirement flags</dt><dd>{selected.requirements.filter((item) => item.mandatory && ["unknown", "unsupported"].includes(item.status)).length}</dd></div></dl></div>{selected.stage === "failed" && <div className="attention-card"><CircleAlert size={19} /><strong>Review needed</strong><p>{jobs.find((job) => job.leadId === selected.id && job.state === "failed")?.error ?? "This tender needs another review before it can move forward."}</p></div>}</div></div></div>}
        {view === "proposals" && <div className="view-enter"><div className="page-heading"><div><div className="overline"><span className="overline-pulse" /> PROPOSAL STUDIO</div><h1>Proposal workspace<span className="heading-dot">.</span></h1><p>Turn grounded opportunity insights into a confident response.</p></div><span className="studio-badge"><Sparkles size={15} /> {readyCount} ready to review</span></div><div className="proposal-layout"><div className="proposal-list panel"><SectionTitle eyebrow="YOUR PROPOSALS" title="Available responses" /><div className="proposal-items">{leads.filter((lead) => lead.stage === "proposal_ready" || lead.stage === "matched").map((lead) => { const running = jobs.find((job) => job.leadId === lead.id && job.operation === "proposal" && job.state === "running"); return <button key={lead.id} className={`proposal-item ${selectedId === lead.id ? "selected" : ""}`} onClick={() => setSelectedId(lead.id)}><span className={`org-avatar avatar-${leads.indexOf(lead) % 5}`}>{initials(lead.organization)}</span><span><strong>{lead.organization}</strong><small>{lead.title}</small>{running ? <em><span className="tiny-dot amber" /> Generating · {running.progress}%</em> : <em className={lead.stage === "proposal_ready" ? "ready" : ""}><span className={`tiny-dot ${lead.stage === "proposal_ready" ? "green" : "muted"}`} />{lead.stage === "proposal_ready" ? "Ready to review" : "Ready to generate"}</em>}</span><ChevronRight size={16} /></button>; })}</div></div><div className="proposal-focus">{selected && ["matched", "proposal_ready"].includes(selected.stage) ? <><ProposalPreview lead={selected} onDownload={downloadDemo} /><div className="proposal-bottom"><div className="panel proposal-info"><span className="eyebrow">EVIDENCE CHECK</span><h3>Built on what we can prove.</h3><p>{selected.coverage ?? "—"}% requirement coverage across {selected.requirements.length} assessed requirements. Review any unknown or unsupported claims before sending.</p><div className="proposal-info-foot"><span><CircleCheck size={17} /> {selected.evidence.length} linked sources</span><span><CircleAlert size={17} /> {selected.requirements.filter((item) => ["unknown", "unsupported"].includes(item.status)).length} review flags</span></div></div>{selected.stage === "matched" && <button className="generate-card" onClick={() => generateProposal(selected)} disabled={jobs.some((job) => job.leadId === selected.id && job.operation === "proposal" && job.state === "running")}><span><Sparkles size={24} /></span><strong>{integration === "live" ? "Proposal workflow pending" : "Generate demo proposal"}</strong><small>{integration === "live" ? "Verified export and delivery are not connected" : "Simulate the n8n creation flow"}</small><ArrowUpRight size={18} /></button>}</div></> : <div className="panel proposal-empty"><FilePlus2 size={30} /><h3>Select a proposal</h3><p>Choose a matched or proposal-ready tender to inspect the preview.</p></div>}</div></div></div>}
        {view === "activity" && <div className="view-enter"><div className="page-heading"><div><div className="overline"><span className="overline-pulse" /> WORKFLOW MONITOR</div><h1>Activity center<span className="heading-dot">.</span></h1><p>Follow every intake, retry, and proposal through its latest stage.</p></div><button className="secondary-button" onClick={reset}><RefreshCcw size={16} /> {integration === "live" ? "Refresh activity" : "Reset demo"}</button></div><div className="activity-layout"><div className="panel activity-panel"><SectionTitle eyebrow="RECENT EVENTS" title="Job activity" action={<span className="time-select">{jobs.length} jobs</span>} /><div className="activity-list">{jobs.length === 0 && <div className="inline-empty"><Clock3 size={20} /> No durable jobs have been recorded yet.</div>}{jobs.map((job) => { const lead = leads.find((item) => item.id === job.leadId); return <button key={job.id} className="activity-row" onClick={() => lead && openLead(lead.id)} disabled={!lead} title={lead ? undefined : "Original tender no longer exists"}><span className={`activity-icon activity-${job.state}`}>{job.state === "completed" ? <Check size={18} /> : job.state === "failed" ? <CircleAlert size={18} /> : <Clock3 size={18} />}</span><span className="activity-copy"><strong>{job.operation === "proposal" ? "Proposal generation" : job.operation === "retry" ? "Tender retry" : "Tender intake"}<span className={`job-state job-${job.state}`}>{job.state}</span></strong><small>{lead?.organization ?? job.leadId} · {job.stage}</small>{job.state === "running" && <span className="job-progress"><span style={{ width: `${job.progress}%` }} /></span>}{job.error && <em>{job.error}</em>}</span><span className="activity-time">{shortDate(job.createdAt)} <ChevronRight size={15} /></span></button>; })}</div></div><div className="activity-aside"><div className="panel health-panel"><span className="eyebrow">SYSTEM SNAPSHOT</span><div className="health-icon"><Activity size={24} /></div><h3>{integration === "live" ? "Connected to n8n." : "Demo is running smoothly."}</h3><p>{integration === "live" ? "Lead and durable job records come from n8n. Proposal actions and artifact downloads remain pending." : "All activity here is simulated locally. Live n8n workflow health will appear after integration."}</p><div className="health-status"><span className="tiny-dot green" /> {integration === "live" ? "Live reads active" : "Local demo active"} <Check size={16} /></div></div><div className="panel note-panel"><span className="eyebrow">INTEGRATION READY</span><h3>Designed for n8n.</h3><p>Lead, job, evidence, match, and artifact views use typed models behind a replaceable adapter.</p><span className="note-code">/webhook/olivesoft/v1</span></div></div></div></div>}
      </main><footer className="main-footer"><span>© 2026 OliveSoft. Intelligence workspace.</span><span><span className="tiny-dot green" /> {integration === "live" ? "n8n connected" : "Demo environment"} <span className="footer-divider">·</span> Built for better bids</span></footer></div>
    {showModal && <NewTenderModal onClose={() => { setShowModal(false); setSelectedDiscovery(null); }} onCreate={createTender} live={integration === "live"} discovery={selectedDiscovery} />}
    {toast && <div className={toast.tone === "error" ? "toast toast-error" : "toast"} role={toast.tone === "error" ? "alert" : "status"}>{toast.tone === "error" ? <CircleAlert size={18} /> : <CircleCheck size={18} />}{toast.message}<button onClick={() => setToast(null)} aria-label="Dismiss"><X size={15} /></button></div>}
  </div>;
}
