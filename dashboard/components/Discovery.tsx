"use client";

import { useState } from "react";
import { ArrowUpRight, Radar, RefreshCcw } from "lucide-react";

export type DiscoveryItem = {
  id: string;
  title: string;
  organization: string;
  summary: string;
  url: string;
  source: "TED" | "Tavily";
  publishedAt: string | null;
};

export default function Discovery({ password, live, onSelect }: { password: string; live: boolean; onSelect: (item: DiscoveryItem) => void }) {
  const [source, setSource] = useState<"ted" | "tavily">("ted");
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scanned, setScanned] = useState(false);

  async function scan(nextSource: "ted" | "tavily") {
    if (!live || busy) return;
    setSource(nextSource); setBusy(true); setError(""); setScanned(false); setItems([]);
    try {
      const response = await fetch(`/api/discovery?source=${nextSource}`, { headers: { "x-olivesoft-upload-password": password }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Tender scan failed.");
      if (!Array.isArray(result.items)) throw new Error("The scan returned an invalid result.");
      setItems(result.items.filter((item: DiscoveryItem) => item && typeof item.title === "string" && /^https:\/\//.test(item.url)));
      setScanned(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tender scan failed."); }
    finally { setBusy(false); }
  }

  return <div className="view-enter discovery-view">
    <div className="page-heading"><div><div className="overline"><span className="overline-pulse" /> TENDER DISCOVERY</div><h1>Find tenders<span className="heading-dot">.</span></h1><p>Search official EU notices or the wider web. Review the source before adding an opportunity to the pipeline.</p></div></div>
    <div className="discovery-controls panel"><div><strong>Choose a source</strong><p>TED returns recent IT service competition notices. Tavily finds additional public tender pages.</p></div><div className="discovery-actions"><button className={`secondary-button ${source === "ted" ? "discovery-selected" : ""}`} disabled={!live || busy} onClick={() => void scan("ted")}><Radar size={16} /> Scan TED</button><button className={`secondary-button ${source === "tavily" ? "discovery-selected" : ""}`} disabled={!live || busy} onClick={() => void scan("tavily")}><RefreshCcw size={16} /> Search web</button></div></div>
    {!live && <div className="panel discovery-empty">Live discovery becomes available after connecting the n8n workspace.</div>}
    {busy && <div className="panel discovery-empty">Searching {source === "ted" ? "TED" : "the web"}…</div>}
    {error && <p className="knowledge-form-error" role="alert">{error}</p>}
    {scanned && <p className="discovery-count">{items.length} results from {source === "ted" ? "TED" : "Tavily"}. Results are suggestions; opening the source is required before intake.</p>}
    <div className="discovery-results">{items.map((item) => <article className="panel discovery-card" key={item.id}><div><span className="eyebrow">{item.source}{item.publishedAt ? ` · ${item.publishedAt}` : ""}</span><h2>{item.title}</h2><p className="discovery-org">{item.organization}</p><p>{item.summary}</p></div><div className="discovery-card-actions"><a className="secondary-button compact" href={item.url} target="_blank" rel="noopener noreferrer">Open source <ArrowUpRight size={15} /></a><button className="primary-button" onClick={() => onSelect(item)}>Review and add <ArrowUpRight size={15} /></button></div></article>)}</div>
  </div>;
}
