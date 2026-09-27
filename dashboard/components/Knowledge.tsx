"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowRight, BookOpen, BrainCircuit, CircleAlert, CloudUpload, Database, FileText, FolderOpen, LockKeyhole, Search, ShieldCheck, X } from "lucide-react";

type Kind = "cv" | "expertise" | "project";
type Pending = { key: string; file: File; kind: Kind };
type Uploaded = { key: string; name: string; storagePath: string; bucket: string };
const labels: Record<Kind, string> = { cv: "CV", expertise: "Expertise", project: "Project reference" };
const accepted = ["pdf", "docx", "txt"];
const maxBytes = 4 * 1024 * 1024;

function sizeLabel(bytes: number) { return bytes < 1048576 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`; }

export default function Knowledge({ initialPassword = "" }: { initialPassword?: string }) {
  const picker = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>("cv");
  const [queue, setQueue] = useState<Pending[]>([]);
  const [uploaded, setUploaded] = useState<Uploaded[]>([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [password, setPassword] = useState(initialPassword);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/knowledge/status", { cache: "no-store" }).then((response) => response.json()).then((value) => setConfigured(value.configured === true)).catch(() => setConfigured(false));
  }, []);

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    const valid = incoming.filter((file) => accepted.includes(file.name.split(".").pop()?.toLowerCase() ?? "") && file.size > 0 && file.size <= maxBytes);
    setError(valid.length === incoming.length ? "" : "Only nonempty PDF, DOCX, or TXT files up to 4 MB can be selected.");
    setQueue((current) => {
      const existing = new Set(current.map((item) => item.key));
      return [...current, ...valid.map((file) => ({ file, kind, key: `${file.name}:${file.size}:${file.lastModified}` })).filter((item) => !existing.has(item.key))];
    });
    if (picker.current) picker.current.value = "";
  }

  function onFilesSelected(event: ChangeEvent<HTMLInputElement>) { if (event.target.files) addFiles(event.target.files); }

  async function uploadSelected() {
    if (!configured || !password || busy) return;
    setBusy(true);
    setError("");
    for (const item of queue) {
      const body = new FormData();
      body.set("file", item.file);
      body.set("kind", item.kind);
      try {
        const response = await fetch("/api/knowledge/upload", { method: "POST", headers: { "x-olivesoft-upload-password": password }, body });
        const result = await response.json();
        if (!response.ok || typeof result.storagePath !== "string" || typeof result.bucket !== "string") throw new Error(result.error || "Supabase did not confirm the upload.");
        setUploaded((current) => [{ key: item.key, name: item.file.name, storagePath: result.storagePath, bucket: result.bucket }, ...current]);
        setQueue((current) => current.filter((entry) => entry.key !== item.key));
      } catch (cause) {
        setError(`${item.file.name}: ${cause instanceof Error ? cause.message : "Upload failed."}`);
        break;
      }
    }
    setBusy(false);
  }

  const counts = { cv: queue.filter((item) => item.kind === "cv").length, expertise: queue.filter((item) => item.kind === "expertise").length, project: queue.filter((item) => item.kind === "project").length };
  const visible = queue.filter((item) => `${item.file.name} ${labels[item.kind]}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="view-enter knowledge-view">
    <div className="page-heading"><div><div className="overline"><span className="overline-pulse" /> INTERNAL KNOWLEDGE <span className="overline-slash">/</span> SUPABASE STORAGE</div><h1>Knowledge base<span className="heading-dot">.</span></h1><p>Upload OliveSoft CVs, expertise, and project references to power evidence-backed matching.</p></div><span className="knowledge-head-status"><span className={`tiny-dot ${configured ? "green" : "amber"}`} /> {configured ? "Upload configured" : "Upload integration pending"}</span></div>
    <div className="knowledge-hero"><div className="knowledge-hero-copy"><span className="knowledge-kicker"><span className={`tiny-dot ${configured ? "green" : "amber"}`} /> {configured ? "PRIVATE STORAGE UPLOAD" : "STORAGE UPLOAD NOT CONNECTED"}</span><h2>From team experience<br />to <em>stronger proposals.</em></h2><p>Your team uploads files here. The platform sends them to OliveSoft’s private Supabase Storage bucket, where n8n can extract and index approved content.</p><div className="knowledge-hero-actions"><button className="hero-button" onClick={() => picker.current?.click()}>Choose files <CloudUpload size={15} /></button><span><ShieldCheck size={14} /> Files remain private until submitted</span></div></div><div className="knowledge-orbit" aria-hidden="true"><span className="knowledge-orbit-ring" /><span className="knowledge-orbit-core"><BrainCircuit size={33} /></span><span className="knowledge-orbit-node node-drive"><FolderOpen size={16} /> STORAGE</span><span className="knowledge-orbit-node node-rag"><Database size={16} /> RAG INDEX</span><span className="knowledge-orbit-node node-match"><BookOpen size={16} /> EVIDENCE</span></div></div>
    <div className="knowledge-metrics"><div><span className="knowledge-metric-icon"><FileText size={19} /></span><small>CVS SELECTED</small><strong>{counts.cv.toString().padStart(2, "0")}</strong></div><div><span className="knowledge-metric-icon"><BrainCircuit size={19} /></span><small>EXPERTISE SELECTED</small><strong>{counts.expertise.toString().padStart(2, "0")}</strong></div><div><span className="knowledge-metric-icon"><BookOpen size={19} /></span><small>PROJECTS SELECTED</small><strong>{counts.project.toString().padStart(2, "0")}</strong></div><div><span className="knowledge-metric-icon"><Database size={19} /></span><small>UPLOADED THIS VISIT</small><strong>{uploaded.length.toString().padStart(2, "0")}</strong></div></div>
    <div className="knowledge-layout"><div className="panel knowledge-catalog"><div className="knowledge-catalog-head"><div><span className="eyebrow">DOCUMENT INTAKE</span><h2>Prepare an upload <span>{queue.length}</span></h2><p>Selected files stay in this section until you submit them.</p></div><div className="knowledge-search"><Search size={16} /><input aria-label="Search selected files" placeholder="Search selected files..." value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div className="knowledge-kind-tabs">{(["cv", "expertise", "project"] as const).map((option) => <button key={option} className={kind === option ? "active" : ""} onClick={() => setKind(option)}>{labels[option]}</button>)}</div><div className={`knowledge-dropzone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}><input ref={picker} type="file" accept=".pdf,.docx,.txt" multiple onChange={onFilesSelected} aria-label={`Choose ${labels[kind]} files`} /><span className="knowledge-drop-icon"><CloudUpload size={25} /></span><strong>Drop {labels[kind].toLowerCase()} files here</strong><p>or choose files from your device · PDF, DOCX, TXT · 4 MB per file</p><button type="button" className="secondary-button" onClick={() => picker.current?.click()}>Browse files</button></div>{error && <p className="knowledge-form-error" role="alert">{error}</p>}{queue.length > 0 && <><div className="knowledge-queue-head"><strong>Files ready to upload</strong><span>{queue.length} file{queue.length === 1 ? "" : "s"}</span></div>{visible.length ? <div className="knowledge-list">{visible.map((item) => <div className="knowledge-row" key={item.key}><span className={`knowledge-file-icon kind-${item.kind}`}>{item.kind === "expertise" ? <BrainCircuit size={19} /> : item.kind === "project" ? <BookOpen size={19} /> : <FileText size={19} />}</span><div className="knowledge-file-copy"><strong>{item.file.name}</strong><small>{labels[item.kind]} <span>·</span> {sizeLabel(item.file.size)} <span>·</span> Local selection</small></div><span className="knowledge-pending"><span className="tiny-dot amber" /> Not uploaded</span><button className="knowledge-row-action" onClick={() => setQueue((current) => current.filter((entry) => entry.key !== item.key))} aria-label={`Remove ${item.file.name} from selection`}><X size={16} /></button></div>)}</div> : <div className="knowledge-no-results">No selected files match that search.</div>}<div className="knowledge-upload-footer"><div className="knowledge-upload-access"><LockKeyhole size={15} />{configured ? <input type="password" aria-label="Team upload password" placeholder="Team upload password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" /> : <span>Upload becomes available when the secure n8n connection is configured.</span>}</div><button className="primary-button" disabled={!configured || !password || busy} onClick={uploadSelected}><CloudUpload size={16} /> {busy ? "Uploading..." : "Upload to Supabase"}</button></div></>}{uploaded.length > 0 && <div className="knowledge-uploaded"><strong>Stored in Supabase · indexing pending</strong>{uploaded.map((item) => <span key={item.key} title={`${item.bucket}/${item.storagePath}`}>{item.name} · {item.bucket}/{item.storagePath}</span>)}</div>}</div><aside className="knowledge-side"><div className="panel knowledge-flow"><span className="eyebrow">HOW THE RAG FLOW WORKS</span><h3>Evidence, end to end.</h3><div className="knowledge-flow-step"><span>01</span><div><strong>Platform upload</strong><small>An authorized teammate selects a CV or expertise file.</small></div></div><ArrowRight className="knowledge-flow-arrow" size={15} /><div className="knowledge-flow-step"><span>02</span><div><strong>Private Supabase Storage</strong><small>n8n stores the original in OliveSoft’s private bucket.</small></div></div><ArrowRight className="knowledge-flow-arrow" size={15} /><div className="knowledge-flow-step"><span>03</span><div><strong>RAG indexing</strong><small>n8n extracts and versions text, then upserts Qdrant chunks.</small></div></div><ArrowRight className="knowledge-flow-arrow" size={15} /><div className="knowledge-flow-step"><span>04</span><div><strong>Evidence review</strong><small>Matches will cite the stored source for human validation.</small></div></div></div><div className="panel knowledge-note"><CircleAlert size={19} /><div><strong>RAG indexing is separate</strong><p>After an upload, Supabase confirms storage. The ingestion workflow must still process the file before it can support tender matching.</p></div></div></aside></div>
  </div>;
}
