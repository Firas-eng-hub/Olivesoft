"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Lead } from "@/lib/types";

export type AcceptanceGuidance = { comments: string; priorities: string; exclusions: string };

export default function AcceptanceDialog({ lead, onClose, onSave }: {
  lead: Lead;
  onClose: () => void;
  onSave: (guidance: AcceptanceGuidance) => Promise<boolean>;
}) {
  const [guidance, setGuidance] = useState<AcceptanceGuidance>({
    comments: lead.acceptanceComments ?? "",
    priorities: lead.acceptancePriorities ?? "",
    exclusions: lead.acceptanceExclusions ?? "",
  });
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, textarea")).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try { if (await onSave(guidance)) onClose(); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="accept-title" ref={dialogRef}><div className="modal-heading"><div><span className="eyebrow">OPPORTUNITY DECISION</span><h2 id="accept-title">{lead.acceptedAt ? "Update acceptance" : "Accept opportunity"}</h2><p>Save your direction for a later proposal. This action does not start generation.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div><form onSubmit={(event) => void submit(event)}><label>Comments for the proposal team<textarea autoFocus rows={4} maxLength={4000} value={guidance.comments} onChange={(event) => setGuidance({ ...guidance, comments: event.target.value })} placeholder="Context, tone, and details to consider" /></label><label>Priorities<textarea rows={3} maxLength={2000} value={guidance.priorities} onChange={(event) => setGuidance({ ...guidance, priorities: event.target.value })} placeholder="What should the response emphasize?" /></label><label>Exclusions<textarea rows={3} maxLength={2000} value={guidance.exclusions} onChange={(event) => setGuidance({ ...guidance, exclusions: event.target.value })} placeholder="What should be left out or treated cautiously?" /></label><div className="modal-footer"><span>Saved with this opportunity for later review.</span><button type="submit" className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save acceptance"}</button></div></form></div></div>;
}
