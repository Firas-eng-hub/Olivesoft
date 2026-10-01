"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowDown, BookOpen, BrainCircuit, CircleAlert, CloudUpload, Database, FileText, FolderOpen, LockKeyhole, Search, ShieldCheck, X } from "lucide-react";
import { friendlyError } from "@/lib/copy";

type Kind = "cv" | "expertise" | "project";
type Pending = { key: string; file: File; kind: Kind };
type StoredDocument = { id: string; docId: string; kind: Kind; name: string; version: number; state: string; storagePath: string; uploadedAt: string };
const labels: Record<Kind, string> = { cv: "CV", expertise: "Expertise", project: "Project reference" };
const accepted = ["pdf", "docx", "txt"];
const maxBytes = 4 * 1024 * 1024;

function sizeLabel(bytes: number) { return bytes < 1048576 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`; }

async function fetchDocuments(password: string): Promise<StoredDocument[]> {
  const response = await fetch("/api/knowledge/documents", { headers: { "x-olivesoft-upload-password": password }, cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !Array.isArray(result.items)) throw new Error(result.error || "Could not load saved documents.");
  return result.items as StoredDocument[];
}

export default function Knowledge({ initialPassword = "" }: { initialPassword?: string }) {
  const picker = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>("cv");
  const [queue, setQueue] = useState<Pending[]>([]);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [documentsError, setDocumentsError] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [password, setPassword] = useState(initialPassword);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/knowledge/status", { cache: "no-store" }).then((response) => response.json()).then((value) => setConfigured(value.configured === true)).catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    if (!configured || !initialPassword) return;
    let active = true;
    fetchDocuments(initialPassword).then((items) => { if (active) { setDocuments(items); setDocumentsError(""); } }).catch((cause) => { if (active) setDocumentsError(friendlyError(cause, "We couldn't load your saved documents. Please try again.")); });
    return () => { active = false; };
  }, [configured, initialPassword]);

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
        if (!response.ok || typeof result.storagePath !== "string" || typeof result.bucket !== "string") throw new Error(result.error || "Upload failed. Please try again.");
        setDocuments((current) => [{ id: result.storagePath, docId: String(result.docId ?? ""), kind: item.kind, name: item.file.name, version: Number(result.version ?? 0), state: "indexing", storagePath: result.storagePath, uploadedAt: new Date().toISOString() }, ...current.filter((document) => document.docId !== result.docId)]);
        setQueue((current) => current.filter((entry) => entry.key !== item.key));
        fetchDocuments(password).then((items) => { setDocuments(items); setDocumentsError(""); }).catch(() => {});
      } catch (cause) {
        setError(friendlyError(cause, `${item.file.name}: Upload failed. Please try again.`));
        break;
      }
    }
    setBusy(false);
  }

  const savedCounts = { cv: documents.filter((item) => item.kind === "cv").length, expertise: documents.filter((item) => item.kind === "expertise").length, project: documents.filter((item) => item.kind === "project").length };
  const visible = queue.filter((item) => `${item.file.name} ${labels[item.kind]}`.toLowerCase().includes(query.toLowerCase()));
  const visibleDocuments = documents.filter((item) => `${item.name} ${labels[item.kind]} ${item.docId}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="view-enter knowledge-view">
    <div className="page-heading"><div><div className="overline"><span className="overline-pulse" /> INTERNAL KNOWLEDGE</div><h1>Knowledge base<span className="heading-dot">.</span></h1><p>Upload OliveSoft CVs, expertise, and project references to power evidence-backed matching.</p></div><span className="knowledge-head-status" title={configured ? "Your files are stored securely" : "Uploads are being set up"}><span className={`tiny-dot ${configured ? "green" : "amber"}`} /> {configured ? "Storage active" : "Uploads coming soon"}</span></div>
    <div className="knowledge-hero"><div className="knowledge-hero-copy"><span className="knowledge-kicker"><span className={`tiny-dot ${configured ? "green" : "amber"}`} /> {configured ? "SECURE PRIVATE STORAGE" : "UPLOADS COMING SOON"}</span><h2>From team experience<br />to <em>stronger proposals.</em></h2><p>Your team uploads files here. They're stored securely and privately, and used to build stronger, evidence-backed proposals.</p><div className="knowledge-hero-actions"><button className="hero-button" onClick={() => picker.current?.click()}>Choose files <CloudUpload size={16} /></button><span><ShieldCheck size={16} /> Files remain private until submitted</span></div></div><div className="knowledge-orbit" aria-hidden="true"><span className="knowledge-orbit-ring" /><span className="knowledge-orbit-core"><BrainCircuit size={32} /></span><span className="knowledge-orbit-node node-drive"><FolderOpen size={16} /> FILES</span><span className="knowledge-orbit-node node-rag"><Database size={16} /> SMART INDEX</span><span className="knowledge-orbit-node node-match"><BookOpen size={16} /> EVIDENCE</span></div></div>
    <div className="knowledge-metrics"><div><span className="knowledge-metric-icon"><FileText size={20} /></span><small>CVS SAVED</small><strong>{savedCounts.cv.toString().padStart(2, "0")}</strong></div><div><span className="knowledge-metric-icon"><BrainCircuit size={20} /></span><small>EXPERTISE SAVED</small><strong>{savedCounts.expertise.toString().padStart(2, "0")}</strong></div><div><span className="knowledge-metric-icon"><BookOpen size={20} /></span><small>PROJECTS SAVED</small><strong>{savedCounts.project.toString().padStart(2, "0")}</strong></div><div><span className="knowledge-metric-icon"><Database size={20} /></span><small>SAVED DOCUMENTS</small><strong>{documents.length.toString().padStart(2, "0")}</strong></div></div>
    <div className="knowledge-layout"><div className="panel knowledge-catalog"><div className="knowledge-catalog-head"><div><span className="eyebrow">DOCUMENT INTAKE</span><h2>Prepare an upload <span>{queue.length}</span></h2><p>Selected files stay in this section until you submit them.</p></div><div className="knowledge-search"><Search size={16} /><input aria-label="Search selected files" placeholder="Search selected files..." value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div className="knowledge-kind-tabs">{(["cv", "expertise", "project"] as const).map((option) => <button key={option} className={kind === option ? "active" : ""} onClick={() => setKind(option)}>{labels[option]}</button>)}</div><div className={`knowledge-dropzone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}><input ref={picker} type="file" accept=".pdf,.docx,.txt" multiple onChange={onFilesSelected} aria-label={`Choose ${labels[kind]} files`} /><span className="knowledge-drop-icon"><CloudUpload size={24} /></span><strong>Drop {labels[kind].toLowerCase()} files here</strong><p>or choose files from your device · PDF, DOCX, TXT · 4 MB per file</p><button type="button" className="secondary-button" onClick={() => picker.current?.click()}>Browse files</button></div>{error && <p className="knowledge-form-error" role="alert">{error}</p>}{queue.length > 0 && <><div className="knowledge-queue-head"><strong>Files ready to upload</strong><span>{queue.length} file{queue.length === 1 ? "" : "s"}</span></div>{visible.length ? <div className="knowledge-list">{visible.map((item) => <div className="knowledge-row" key={item.key}><span className={`knowledge-file-icon kind-${item.kind}`}>{item.kind === "expertise" ? <BrainCircuit size={20} /> : item.kind === "project" ? <BookOpen size={20} /> : <FileText size={20} />}</span><div className="knowledge-file-copy"><strong>{item.file.name}</strong><small>{labels[item.kind]} <span>·</span> {sizeLabel(item.file.size)} <span>·</span> Local selection</small></div><span className="knowledge-pending"><span className="tiny-dot amber" /> Not uploaded</span><button className="knowledge-row-action" onClick={() => setQueue((current) => current.filter((entry) => entry.key !== item.key))} aria-label={`Remove ${item.file.name} from selection`}><X size={16} /></button></div>)}</div> : <div className="knowledge-no-results">No selected files match that search.</div>}<div className="knowledge-upload-footer"><div className="knowledge-upload-access"><LockKeyhole size={16} />{configured ? <input type="password" aria-label="Team upload password" placeholder="Team upload password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" /> : <span>Uploads are being set up - check back soon.</span>}</div><button className="primary-button" disabled={!configured || !password || busy} onClick={uploadSelected}><CloudUpload size={16} /> {busy ? "Uploading..." : "Upload files"}</button></div></>}{documentsError && <p className="knowledge-form-error" role="alert">{documentsError}</p>}<div className="knowledge-uploaded"><strong>Saved documents · {documents.length}</strong>{visibleDocuments.length ? visibleDocuments.map((item) => <span key={item.id}>{labels[item.kind]} · {item.name} · {item.state === "indexed" ? "Ready" : "Processing"}</span>) : <span>{documents.length ? "No saved documents match this search." : "No saved documents yet."}</span>}</div></div><aside className="knowledge-side"><div className="panel knowledge-flow"><span className="eyebrow">HOW IT WORKS</span><h3>Evidence, end to end.</h3><div className="knowledge-flow-step"><span>01</span><div><strong>Platform upload</strong><small>An authorized teammate selects a CV or expertise file.</small></div></div><ArrowDown className="knowledge-flow-arrow" size={16} /><div className="knowledge-flow-step"><span>02</span><div><strong>Secure storage</strong><small>Files are stored privately, visible only to your team.</small></div></div><ArrowDown className="knowledge-flow-arrow" size={16} /><div className="knowledge-flow-step"><span>03</span><div><strong>Smart indexing</strong><small>We extract the text and prepare it for accurate matching.</small></div></div><ArrowDown className="knowledge-flow-arrow" size={16} /><div className="knowledge-flow-step"><span>04</span><div><strong>Evidence review</strong><small>Matches will cite the stored source for human validation.</small></div></div></div><div className="panel knowledge-note"><CircleAlert size={20} /><div><strong>Processing takes a moment</strong><p>After an upload, the file is stored securely. It becomes available for matching once processing completes.</p></div></div></aside></div>
  </div>;
}
