"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bell, BookOpen, Check, CheckCheck,
  ChevronDown, ChevronRight, CircleAlert, CircleCheck, Clock3, Command, Download,
  ExternalLink, FileDown, FilePlus2, FileText, Filter, FolderOpen, Gauge, LayoutDashboard,
  Menu, MoreHorizontal, Plus, Radar, RefreshCcw, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, TrendingUp, X, Zap,
} from "lucide-react";
import { createLead } from "@/lib/demo-data";
import { demoAdapter, resetDemo } from "@/lib/adapter";
import type { DashboardData, Job, Lead, LeadStage, MatchStatus } from "@/lib/types";
import Knowledge from "@/components/Knowledge";

type View = "overview" | "pipeline" | "lead" | "knowledge" | "proposals" | "activity";
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

function TrendChart() {
  const bars = [33, 50, 41, 68, 55, 74, 63, 89, 71, 85, 76, 95];
  return <div className="trend-chart">
    <div className="chart-grid"><span>100</span><span>75</span><span>50</span><span>25</span></div>
    <div className="chart-bars">{bars.map((height, index) => <div className="chart-column" key={index}><div className="chart-bar" style={{ height: `${height}%`, animationDelay: `${index * 55}ms` }}><span className="chart-tooltip">{Math.round(height * .78)} leads</span></div></div>)}</div>
    <div className="chart-months"><span>Jan</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span><span>Nov</span></div>
  </div>;
}

function PipelineGraphic({ leads }: { leads: Lead[] }) {
  const counts = stageOrder.map((stage) => leads.filter((lead) => lead.stage === stage).length);
  const icons = [Radar, Search, CheckCheck, FileText];
  return <div className="pipeline-graphic">
    <div className="pipeline-track" aria-hidden="true"><div className="pipeline-track-fill" /></div>
    {stageOrder.map((stage, index) => {
      const Icon = icons[index];
      return <div className="pipeline-step" key={stage}><div className={`pipeline-orb orb-${index}`}><Icon size={20} strokeWidth={1.9} /></div><span className="pipeline-number">{counts[index].toString().padStart(2, "0")}</span><span className="pipeline-label">{stageLabels[stage]}</span></div>;
    })}
  </div>;
}

function LeadTable({ leads, onOpen, compact = false }: { leads: Lead[]; onOpen: (id: string) => void; compact?: boolean }) {
  if (!leads.length) return <div className="empty-state"><Search size={26} /><strong>No tenders found</strong><span>Try a different search or filter.</span></div>;
  return <div className="table-scroll"><table className="leads-table"><thead><tr><th>OPPORTUNITY</th><th>STATUS</th><th>FIT SCORE</th><th>DEADLINE</th>{!compact && <th>PRIORITY</th>}<th aria-label="Open" /></tr></thead><tbody>{leads.map((lead, index) => <tr key={lead.id} onClick={() => onOpen(lead.id)} style={{ animationDelay: `${index * 35}ms` }} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onOpen(lead.id); }}><td><div className="lead-cell"><span className={`org-avatar avatar-${index % 5}`}>{initials(lead.organization)}</span><div><strong>{lead.title}</strong><small>{lead.organization} <span className="cell-separator">·</span> {lead.id}</small></div></div></td><td><StatusPill stage={lead.stage} /></td><td>{lead.score === null ? <span className="muted-value">—</span> : <div className="score-cell"><strong>{lead.score}%</strong><span className="score-track"><span style={{ width: `${lead.score}%` }} /></span></div>}</td><td><span className="date-cell">{shortDate(lead.deadline)}</span></td>{!compact && <td><span className={`priority priority-${lead.priority.toLowerCase()}`}><span />{lead.priority}</span></td>}<td><ChevronRight size={17} className="row-chevron" /></td></tr>)}</tbody></table></div>;
}

function StatCard({ icon, label, value, change, tint, spark }: { icon: ReactNode; label: string; value: string; change: string; tint: string; spark: number[] }) {
  return <div className="stat-card"><div className="stat-top"><span className={`stat-icon tint-${tint}`}>{icon}</span><MoreHorizontal size={18} className="stat-menu" /></div><div className="stat-label">{label}</div><div className="stat-bottom"><div><strong className="stat-value">{value}</strong><span className="stat-change"><ArrowUpRight size={14} />{change}</span></div><Sparkline values={spark} color={tint === "purple" ? "#25d9ca" : tint === "orange" ? "#f1ad71" : tint === "green" ? "#56d8b1" : "#29bce0"} /></div></div>;
}

function NewTenderModal({ onClose, onCreate }: { onClose: () => void; onCreate: (input: { title: string; organization: string; summary: string; deadline: string }) => void }) {
  const [form, setForm] = useState({ title: "", organization: "", summary: "", deadline: "" });
  const valid = form.title.trim().length >= 4 && form.organization.trim().length >= 2 && form.summary.trim().length >= 12;
  function submit(event: FormEvent) { event.preventDefault(); if (valid) onCreate(form); }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="eyebrow">DEMO INTAKE</span><h2 id="modal-title">Add a new tender</h2><p>Create a local demo opportunity. It will not be sent to n8n.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div><form onSubmit={submit}><label>Opportunity title<input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Digital Infrastructure Program" maxLength={100} required /></label><div className="modal-grid"><label>Organization<input value={form.organization} onChange={(event) => setForm({ ...form, organization: event.target.value })} placeholder="Organization name" maxLength={80} required /></label><label>Deadline<input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label></div><label>Brief summary<textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="What is the organization looking to achieve?" rows={4} maxLength={700} required /></label><div className="modal-footer"><span><ShieldCheck size={15} /> Stored in this browser only</span><button type="submit" className="primary-button" disabled={!valid}><Plus size={17} /> Create tender</button></div></form></div></div>;
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
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [detailTab, setDetailTab] = useState<"overview" | "requirements" | "evidence">("overview");

  useEffect(() => { demoAdapter.load().then(setData); }, []);
  useEffect(() => { if (data) void demoAdapter.save(data); }, [data]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 3500); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!data?.jobs.some((job) => job.state === "running" && job.operation === "proposal")) return;
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
  }, [data?.jobs]);

  const leads = data?.leads ?? [];
  const jobs = data?.jobs ?? [];
  const selected = leads.find((lead) => lead.id === selectedId) ?? leads[0];
  const filtered = useMemo(() => leads.filter((lead) => {
    const text = `${lead.title} ${lead.organization} ${lead.tags.join(" ")} ${lead.id}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (filter === "all" || lead.stage === filter);
  }), [leads, search, filter]);
  const readyCount = leads.filter((lead) => lead.stage === "proposal_ready").length;
  const matchedCount = leads.filter((lead) => lead.stage === "matched").length;
  const avgFit = leads.filter((lead) => lead.score !== null).reduce((sum, lead, _, all) => sum + (lead.score ?? 0) / all.length, 0);

  function navigate(next: View) { setView(next); setMobileNav(false); setSearch(""); setFilter("all"); }
  function openLead(id: string) { setSelectedId(id); setDetailTab("overview"); navigate("lead"); }
  function createTender(input: { title: string; organization: string; summary: string; deadline: string }) {
    const lead = createLead(input);
    const job: Job = { id: `JOB-DEMO-${Date.now().toString(36).toUpperCase()}`, leadId: lead.id, operation: "intake", state: "completed", stage: "Demo intake recorded", progress: 100, createdAt: new Date().toISOString() };
    setData((current) => current ? { leads: [lead, ...current.leads], jobs: [job, ...current.jobs] } : current);
    setShowModal(false); setToast("Tender added to your demo workspace"); openLead(lead.id);
  }
  function generateProposal(lead: Lead) {
    if (lead.stage !== "matched") return;
    if (jobs.some((job) => job.leadId === lead.id && job.operation === "proposal" && job.state === "running")) return;
    const job: Job = { id: `JOB-DEMO-${Date.now().toString(36).toUpperCase()}`, leadId: lead.id, operation: "proposal", state: "running", stage: "Assembling evidence", progress: 8, createdAt: new Date().toISOString() };
    setData((current) => current ? { ...current, jobs: [job, ...current.jobs] } : current);
    setToast("Demo proposal generation started");
  }
  function retryLead(lead: Lead) {
    if (lead.stage !== "failed") return;
    setData((current) => current ? { leads: current.leads.map((item) => item.id === lead.id ? { ...item, stage: "detected" } : item), jobs: [{ id: `JOB-DEMO-${Date.now().toString(36).toUpperCase()}`, leadId: lead.id, operation: "retry", state: "completed", stage: "Reset to detected for review", progress: 100, createdAt: new Date().toISOString() }, ...current.jobs] } : current);
    setToast("Tender reset to Detected for review");
  }
  function downloadDemo(kind: "pdf" | "pptx") {
    const anchor = document.createElement("a");
    anchor.href = `/demo/OliveSoft_Proposal_DEMO.${kind}`;
    anchor.download = `OliveSoft_Proposal_DEMO.${kind}`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setToast(`Downloading sample ${kind.toUpperCase()} · Demo file`);
  }
  async function reset() { const fresh = await resetDemo(); setData(fresh); setSelectedId("OS-2026-041"); navigate("overview"); setToast("Demo workspace restored"); }

  if (!data) return <div className="loading-screen"><div className="loading-brand"><span className="brand-mark"><span /></span> OliveSoft</div><span className="loading-ring" /><p>Opening intelligence workspace...</p></div>;

  const navItems: { id: View; label: string; icon: ReactNode; badge?: string }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard size={19} /> },
    { id: "pipeline", label: "Tender pipeline", icon: <Radar size={19} />, badge: String(leads.length) },
    { id: "knowledge", label: "Knowledge base", icon: <BookOpen size={19} /> },
    { id: "proposals", label: "Proposals", icon: <FolderOpen size={19} /> },
    { id: "activity", label: "Activity", icon: <Activity size={19} /> },
  ];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="sidebar-top"><button className="brand" onClick={() => navigate("overview")}><span className="brand-mark"><span /></span><span>Olive<span className="brand-strong">Soft</span><small>INTELLIGENCE</small></span></button><button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={19} /></button></div>
      <div className="workspace-switch"><span className="workspace-avatar">O</span><span><strong>OliveSoft Studio</strong><small>Team workspace</small></span><ChevronDown size={15} /></div>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">{navItems.map((item) => <button key={item.id} className={`nav-item ${view === item.id || (view === "lead" && item.id === "pipeline") ? "active" : ""}`} onClick={() => navigate(item.id)}>{item.icon}<span>{item.label}</span>{item.badge && <small>{item.badge}</small>}</button>)}</nav>
      <div className="sidebar-section-label sidebar-label-second">QUICK ACCESS</div>
      <button className="nav-item quick-link" onClick={() => { setFilter("matched"); setView("pipeline"); setMobileNav(false); }}><Sparkles size={19} /><span>Ready to propose</span><small>{matchedCount}</small></button>
      <button className="nav-item quick-link" onClick={() => { setFilter("failed"); setView("pipeline"); setMobileNav(false); }}><CircleAlert size={19} /><span>Needs attention</span><small>{leads.filter((lead) => lead.stage === "failed").length}</small></button>
      <div className="sidebar-spacer" />
      <div className="sidebar-callout"><span className="callout-icon"><Zap size={18} fill="currentColor" /></span><strong>Make every bid count.</strong><p>Your next opportunity is already in motion.</p><button onClick={() => setShowModal(true)}>Add tender <ArrowUpRight size={15} /></button></div>
      <div className="sidebar-footer"><div className="footer-avatar">OS</div><div><strong>OliveSoft Team</strong><small>Demo workspace</small></div><span className="online-dot" /></div>
    </aside>
    {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close menu" />}
    <div className="main-area"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={21} /></button><span className="breadcrumb">Workspace <ChevronRight size={14} /> <strong>{view === "lead" ? selected?.organization : view === "pipeline" ? "Tender pipeline" : view === "knowledge" ? "Knowledge base" : view[0].toUpperCase() + view.slice(1)}</strong></span></div><div className="topbar-right"><span className="demo-chip"><span /> DEMO MODE</span><button className="header-search" onClick={() => navigate("pipeline")}><Search size={17} /><span>Search opportunities</span><kbd>⌘ K</kbd></button><button className="top-icon" onClick={() => navigate("activity")} aria-label="Activity"><Bell size={19} /><span /></button><span className="top-avatar">OS</span></div></header>
      <main className="content">
        {view === "overview" && <div className="view-enter">
          <div className="page-heading"><div><div className="overline"><span className="overline-pulse" /> INTELLIGENCE WORKSPACE <span className="overline-slash">/</span> DEMO OVERVIEW</div><h1>Command center<span className="heading-dot">.</span></h1><p>A clearer view of every opportunity, from first signal to final proposal.</p></div><button className="primary-button" onClick={() => setShowModal(true)}><Plus size={18} /> Add new tender</button></div>
          <div className="hero-banner"><div className="hero-copy"><span className="hero-badge"><Sparkles size={13} /> THE OPPORTUNITY ENGINE</span><h2>Turn intelligence into<br /><em>your next big win.</em></h2><p>Discover high-fit tenders, inspect the evidence, and move confidently toward a stronger proposal.</p><button className="hero-button" onClick={() => navigate("pipeline")}>Explore pipeline <ArrowUpRight size={17} /></button></div><div className="hero-visual" aria-hidden="true"><div className="visual-ring ring-a" /><div className="visual-ring ring-b" /><div className="visual-ring ring-c" /><div className="visual-center"><span className="brand-mark"><span /></span></div><div className="orbit-chip orbit-one"><Radar size={15} /> DETECT</div><div className="orbit-chip orbit-two"><ShieldCheck size={15} /> VERIFY</div><div className="orbit-chip orbit-three"><FileText size={15} /> PROPOSE</div><div className="visual-glow" /></div></div>
          <div className="stats-grid"><StatCard icon={<Radar size={21} />} label="Total opportunities" value={String(leads.length).padStart(2, "0")} change="12.8%" tint="blue" spark={[18, 22, 19, 27, 29, 32, 36, 44]} /><StatCard icon={<Gauge size={21} />} label="Average fit score" value={`${Math.round(avgFit)}%`} change="8.2%" tint="purple" spark={[20, 24, 21, 30, 29, 35, 38, 43]} /><StatCard icon={<CheckCheck size={21} />} label="Matched opportunities" value={String(matchedCount).padStart(2, "0")} change="4.3%" tint="green" spark={[13, 18, 22, 20, 26, 30, 32, 40]} /><StatCard icon={<FileText size={21} />} label="Proposals ready" value={String(readyCount).padStart(2, "0")} change="16.4%" tint="orange" spark={[8, 11, 14, 20, 18, 26, 29, 38]} /></div>
          <div className="overview-grid"><div className="panel trend-panel"><SectionTitle eyebrow="PERFORMANCE" title="Opportunity momentum" action={<span className="time-select">This year <ChevronDown size={14} /></span>} /><div className="chart-summary"><strong>+24.8%</strong><span><TrendingUp size={15} /> vs. previous period</span></div><TrendChart /></div><div className="panel pipeline-panel"><SectionTitle eyebrow="WORKFLOW" title="Your pipeline" action={<button className="text-link" onClick={() => navigate("pipeline")}>View all <ArrowUpRight size={15} /></button>} /><p className="panel-description">A real-time view of where each opportunity stands.</p><PipelineGraphic leads={leads} /><div className="pipeline-foot"><span><span className="tiny-dot green" /> {readyCount} proposals ready</span><span><span className="tiny-dot amber" /> {matchedCount} awaiting action</span></div></div></div>
          <div className="panel table-panel"><SectionTitle eyebrow="TOP OPPORTUNITIES" title="Recent tenders" action={<button className="text-link" onClick={() => navigate("pipeline")}>View pipeline <ArrowRight size={15} /></button>} /><LeadTable leads={leads.slice(0, 5)} onOpen={openLead} compact /></div>
          <button className="knowledge-overview-link" onClick={() => navigate("knowledge")}><span className="knowledge-overview-icon"><BookOpen size={20} /></span><span><strong>Build the OliveSoft knowledge base</strong><small>Prepare CVs, expertise, and project files for upload to Drive and future RAG matching.</small></span><ArrowUpRight size={18} /></button>
        </div>}
        {view === "knowledge" && <Knowledge />}
        {view === "pipeline" && <div className="view-enter"><div className="page-heading"><div><div className="overline"><span className="overline-pulse" /> OPPORTUNITY INTELLIGENCE</div><h1>Tender pipeline<span className="heading-dot">.</span></h1><p>Track every opportunity and focus on the bids that matter most.</p></div><button className="primary-button" onClick={() => setShowModal(true)}><Plus size={18} /> Add new tender</button></div><div className="pipeline-summary"><div><span>ALL OPPORTUNITIES</span><strong>{leads.length.toString().padStart(2, "0")}</strong></div><div><span>IN RESEARCH</span><strong>{leads.filter((lead) => lead.stage === "researched").length.toString().padStart(2, "0")}</strong></div><div><span>READY TO PROPOSE</span><strong>{matchedCount.toString().padStart(2, "0")}</strong></div><div><span>PROPOSALS READY</span><strong>{readyCount.toString().padStart(2, "0")}</strong></div></div><div className="panel pipeline-list-panel"><div className="list-toolbar"><div className="list-title"><span className="eyebrow">PIPELINE BOARD</span><h2>All opportunities <span>{filtered.length}</span></h2></div><div className="list-controls"><div className="search-field"><Search size={17} /><input aria-label="Search opportunities" placeholder="Search opportunities..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="filter-wrap"><Filter size={16} /><select aria-label="Filter by stage" value={filter} onChange={(event) => setFilter(event.target.value as FilterStage)}><option value="all">All stages</option>{([...stageOrder, "failed"] as LeadStage[]).map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select><ChevronDown size={14} /></div></div></div><div className="filter-tabs">{(["all", "detected", "researched", "matched", "proposal_ready", "failed"] as FilterStage[]).map((stage) => <button key={stage} className={filter === stage ? "selected" : ""} onClick={() => setFilter(stage)}>{stage === "all" ? "All tenders" : stageLabels[stage]}<span>{stage === "all" ? leads.length : leads.filter((lead) => lead.stage === stage).length}</span></button>)}</div><LeadTable leads={filtered} onOpen={openLead} /></div></div>}
        {view === "lead" && selected && <div className="view-enter"><button className="back-link" onClick={() => navigate("pipeline")}><ArrowLeft size={16} /> Back to pipeline</button><div className="detail-head"><div><div className="detail-kicker"><span>{selected.id}</span><span className="detail-divider">/</span><span>{selected.sector}</span></div><h1>{selected.title}<span className="heading-dot">.</span></h1><p>{selected.organization} <span>·</span> {selected.location}</p></div><div className="detail-actions"><StatusPill stage={selected.stage} />{selected.stage === "matched" && <button className="primary-button" onClick={() => generateProposal(selected)} disabled={jobs.some((job) => job.leadId === selected.id && job.operation === "proposal" && job.state === "running")}><Sparkles size={17} /> Generate proposal</button>}{selected.stage === "failed" && <button className="primary-button" onClick={() => retryLead(selected)}><RefreshCcw size={17} /> Retry intake</button>}{selected.stage === "proposal_ready" && <button className="primary-button" onClick={() => { navigate("proposals"); setSelectedId(selected.id); }}><FileText size={17} /> View proposal</button>}</div></div><div className="detail-metrics"><div><span>FIT SCORE</span><strong>{selected.score === null ? "—" : `${selected.score}%`}</strong><small>Relevance rubric</small></div><div><span>REQUIREMENT COVERAGE</span><strong>{selected.coverage === null ? "—" : `${selected.coverage}%`}</strong><small>Evidence-linked support</small></div><div><span>SUBMISSION DEADLINE</span><strong>{shortDate(selected.deadline)}</strong><small>{selected.deadline ? new Date(selected.deadline).getFullYear() : "Not provided"}</small></div><div><span>PRIORITY</span><strong>{selected.priority}</strong><small>Bid team review</small></div></div><div className="detail-grid"><div className="detail-main"><div className="detail-tabs"><button className={detailTab === "overview" ? "active" : ""} onClick={() => setDetailTab("overview")}>Overview</button><button className={detailTab === "requirements" ? "active" : ""} onClick={() => setDetailTab("requirements")}>Requirements <span>{selected.requirements.length}</span></button><button className={detailTab === "evidence" ? "active" : ""} onClick={() => setDetailTab("evidence")}>Evidence <span>{selected.evidence.length}</span></button></div>{detailTab === "overview" && <><div className="panel detail-panel"><SectionTitle eyebrow="OPPORTUNITY BRIEF" title="What this tender needs" /><p className="summary-text">{selected.summary}</p><div className="tag-list">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div><div className="panel detail-panel"><SectionTitle eyebrow="INTELLIGENCE" title="Requirement coverage" action={<button className="text-link" onClick={() => setDetailTab("requirements")}>View matrix <ArrowUpRight size={15} /></button>} />{selected.requirements.length ? <div className="requirement-list">{selected.requirements.slice(0, 4).map((requirement) => <div className="requirement-row" key={requirement.id}><div><span className="req-id">{requirement.id}</span><strong>{requirement.label}</strong></div><MatchPill status={requirement.status} /></div>)}</div> : <div className="inline-empty"><CircleAlert size={20} /> Requirements will appear after n8n detection and matching.</div>}</div></>}{detailTab === "requirements" && <div className="panel detail-panel"><SectionTitle eyebrow="EVIDENCE-LINKED MATRIX" title="Requirement matching" /><p className="panel-description">Demo assessments are illustrative. Candidate availability and unsupported claims require human review.</p>{selected.requirements.length ? <div className="requirements-full">{selected.requirements.map((requirement) => <div className="requirement-card" key={requirement.id}><div className="requirement-card-top"><div><span className="req-id">{requirement.id}{requirement.mandatory && <span className="mandatory">MANDATORY</span>}</span><h3>{requirement.label}</h3></div><MatchPill status={requirement.status} /></div><p>{requirement.note || "Demo evidence assessment. Review sources before making a proposal claim."}</p><span className="evidence-count"><FileText size={14} /> {requirement.evidenceIds.length} linked source{requirement.evidenceIds.length === 1 ? "" : "s"}</span></div>)}</div> : <div className="empty-state"><SlidersHorizontal size={25} /><strong>No matches yet</strong><span>This newly detected tender is awaiting the n8n matching workflow.</span></div>}</div>}{detailTab === "evidence" && <div className="panel detail-panel"><SectionTitle eyebrow="SOURCE RECORD" title="Evidence library" /><p className="panel-description">Every statement should trace back to a source record or internal asset.</p>{selected.evidence.length ? <div className="evidence-list">{selected.evidence.map((item) => <div className="evidence-card" key={item.id}><div className="evidence-icon"><FileText size={19} /></div><div><div className="evidence-title"><strong>{item.title}</strong>{item.assetRef && <span>{item.assetRef}</span>}</div><small>{item.source} · Retrieved {shortDate(item.retrievedAt)}</small><p>“{item.excerpt}”</p></div></div>)}</div> : <div className="empty-state"><FolderOpen size={25} /><strong>No evidence recorded</strong><span>Research has not supplied source material for this tender.</span></div>}</div>}</div><div className="detail-side"><div className="panel side-panel"><span className="eyebrow">WORKFLOW PROGRESS</span><h3>From signal to proposal</h3><div className="stage-list">{stageOrder.map((stage, index) => { const currentIndex = stageOrder.indexOf(selected.stage); const done = currentIndex >= index; return <div key={stage} className={`stage-row ${done ? "done" : ""}`}><span className="stage-icon">{done ? <Check size={15} /> : index + 1}</span><div><strong>{stageLabels[stage]}</strong><small>{["Tender captured", "Prospect context", "Evidence matched", "Documents exported"][index]}</small></div></div>; })}</div></div><div className="panel side-panel source-panel"><span className="eyebrow">SOURCE DETAILS</span><dl><div><dt>Source</dt><dd>{selected.source}</dd></div><div><dt>Detected</dt><dd>{relativeDate(selected.detectedAt)}</dd></div><div><dt>Evidence records</dt><dd>{selected.evidence.length}</dd></div><div><dt>Requirement flags</dt><dd>{selected.requirements.filter((item) => item.mandatory && ["unknown", "unsupported"].includes(item.status)).length}</dd></div></dl></div>{selected.stage === "failed" && <div className="attention-card"><CircleAlert size={19} /><strong>Review needed</strong><p>{jobs.find((job) => job.leadId === selected.id && job.state === "failed")?.error ?? "This tender needs another review before it can move forward."}</p></div>}</div></div></div>}
        {view === "proposals" && <div className="view-enter"><div className="page-heading"><div><div className="overline"><span className="overline-pulse" /> PROPOSAL STUDIO</div><h1>Proposal workspace<span className="heading-dot">.</span></h1><p>Turn grounded opportunity insights into a confident response.</p></div><span className="studio-badge"><Sparkles size={15} /> {readyCount} ready to review</span></div><div className="proposal-layout"><div className="proposal-list panel"><SectionTitle eyebrow="YOUR PROPOSALS" title="Available responses" /><div className="proposal-items">{leads.filter((lead) => lead.stage === "proposal_ready" || lead.stage === "matched").map((lead) => { const running = jobs.find((job) => job.leadId === lead.id && job.operation === "proposal" && job.state === "running"); return <button key={lead.id} className={`proposal-item ${selectedId === lead.id ? "selected" : ""}`} onClick={() => setSelectedId(lead.id)}><span className={`org-avatar avatar-${leads.indexOf(lead) % 5}`}>{initials(lead.organization)}</span><span><strong>{lead.organization}</strong><small>{lead.title}</small>{running ? <em><span className="tiny-dot amber" /> Generating · {running.progress}%</em> : <em className={lead.stage === "proposal_ready" ? "ready" : ""}><span className={`tiny-dot ${lead.stage === "proposal_ready" ? "green" : "muted"}`} />{lead.stage === "proposal_ready" ? "Ready to review" : "Ready to generate"}</em>}</span><ChevronRight size={16} /></button>; })}</div></div><div className="proposal-focus">{selected && ["matched", "proposal_ready"].includes(selected.stage) ? <><ProposalPreview lead={selected} onDownload={downloadDemo} /><div className="proposal-bottom"><div className="panel proposal-info"><span className="eyebrow">EVIDENCE CHECK</span><h3>Built on what we can prove.</h3><p>{selected.coverage ?? "—"}% requirement coverage across {selected.requirements.length} assessed requirements. Review any unknown or unsupported claims before sending.</p><div className="proposal-info-foot"><span><CircleCheck size={17} /> {selected.evidence.length} linked sources</span><span><CircleAlert size={17} /> {selected.requirements.filter((item) => ["unknown", "unsupported"].includes(item.status)).length} review flags</span></div></div>{selected.stage === "matched" && <button className="generate-card" onClick={() => generateProposal(selected)} disabled={jobs.some((job) => job.leadId === selected.id && job.operation === "proposal" && job.state === "running")}><span><Sparkles size={24} /></span><strong>Generate demo proposal</strong><small>Simulate the n8n creation flow</small><ArrowUpRight size={18} /></button>}</div></> : <div className="panel proposal-empty"><FilePlus2 size={30} /><h3>Select a proposal</h3><p>Choose a matched or proposal-ready tender to inspect the preview.</p></div>}</div></div></div>}
        {view === "activity" && <div className="view-enter"><div className="page-heading"><div><div className="overline"><span className="overline-pulse" /> WORKFLOW MONITOR</div><h1>Activity center<span className="heading-dot">.</span></h1><p>Follow every intake, retry, and proposal through its latest stage.</p></div><button className="secondary-button" onClick={reset}><RefreshCcw size={16} /> Reset demo</button></div><div className="activity-layout"><div className="panel activity-panel"><SectionTitle eyebrow="RECENT EVENTS" title="Job activity" action={<span className="time-select">{jobs.length} jobs</span>} /><div className="activity-list">{jobs.map((job) => { const lead = leads.find((item) => item.id === job.leadId); return <button key={job.id} className="activity-row" onClick={() => lead && openLead(lead.id)}><span className={`activity-icon activity-${job.state}`}>{job.state === "completed" ? <Check size={18} /> : job.state === "failed" ? <CircleAlert size={18} /> : <Clock3 size={18} />}</span><span className="activity-copy"><strong>{job.operation === "proposal" ? "Proposal generation" : job.operation === "retry" ? "Tender retry" : "Tender intake"}<span className={`job-state job-${job.state}`}>{job.state}</span></strong><small>{lead?.organization ?? job.leadId} · {job.stage}</small>{job.state === "running" && <span className="job-progress"><span style={{ width: `${job.progress}%` }} /></span>}{job.error && <em>{job.error}</em>}</span><span className="activity-time">{shortDate(job.createdAt)} <ChevronRight size={15} /></span></button>; })}</div></div><div className="activity-aside"><div className="panel health-panel"><span className="eyebrow">SYSTEM SNAPSHOT</span><div className="health-icon"><Activity size={24} /></div><h3>Demo is running smoothly.</h3><p>All activity here is simulated locally. Live n8n workflow health will appear after integration.</p><div className="health-status"><span className="tiny-dot green" /> Local demo active <Check size={16} /></div></div><div className="panel note-panel"><span className="eyebrow">INTEGRATION READY</span><h3>Designed for n8n.</h3><p>Lead, job, evidence, match, and artifact views use typed models behind a replaceable adapter.</p><span className="note-code">/webhook/olivesoft/v1</span></div></div></div></div>}
      </main><footer className="main-footer"><span>© 2026 OliveSoft. Intelligence workspace.</span><span><span className="tiny-dot green" /> Demo environment <span className="footer-divider">·</span> Built for better bids</span></footer></div>
    {showModal && <NewTenderModal onClose={() => setShowModal(false)} onCreate={createTender} />}
    {toast && <div className="toast" role="status"><CircleCheck size={18} />{toast}<button onClick={() => setToast("")} aria-label="Dismiss"><X size={15} /></button></div>}
  </div>;
}
