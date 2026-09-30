# OliveSoft — Full Project Review vs. Specification Book

Review date: **2026-09-29** · Reviewer: Dhiya · Scope: local `dhiya` branch tree (matches `origin/dev` layout), `Plan.md`, `Truth.md`, `docs/`, `n8n/workflows/`, `dashboard/`.
Spec source: `olive soft specification book.pdf` — CSTAM 3.0 challenge **CSTAM-OliveSoft**, "Automated RFP Intelligence & Commercial Proposal Generation System".

---

## 1. What the specification book requires

| Phase | Items (points) | Deliverables |
|---|---|---|
| **Phase 1 — MVP (50 pts)** | Lead & Tender Detection (15) · Robust RAG Knowledge Retrieval (15) · Agentic Prospect Research (10) · n8n Workflow Orchestration (10) | Architecture diagram + data-pipeline flow doc · source repo (n8n workflows + RAG) · short MVP video |
| **Phase 2 — Integration & Testing (30 pts)** | Generative Presentation & Proposal Output (15) · RAG Benchmark & Retrieval Precision (10) · Edge Case & Data Validation (5) | RAG benchmark + evaluation report + test-suite results |
| **Phase 3 — UI/UX & Docs (10 pts)** | Dashboard: view leads, inspect matched assets, review research, **edit generated parameters**, download decks | Finalized UI/UX · technical report · full demo video |
| **Phase 4 — Pitching (10 pts)** | Pitch deck, live demo, Q&A | — |
| **Bonus (+2 each)** | PPTX+PDF export · requirements matrix & score · competitor/budget insights agent · human-in-the-loop slide editing · multi-source crawler | — |

---

## 2. What is actually good

1. **Architecture pivot is real.** The all-n8n target is honored in the exports: 7 credential-free workflow JSONs, no FastAPI/SQLAlchemy runtime anywhere in the tree, short JS Code nodes + SQL only. `npm run typecheck` passes.
2. **Tender detection works live (01).** Authenticated webhook (`headerAuth`), LLM extraction with structured-output parser, Postgres persistence. Live evidence: lead `8f4ee6a1-…` created (exec 63) and read back (exec 68).
3. **Tender discovery is the strongest feature (13).** TED API + Tavily with a tested SerpApi fallback (forced-failure test passed, exec 116–120), review-before-intake flow in the dashboard. This already covers the multi-source-crawler bonus.
4. **Knowledge ingestion is genuinely built (03).** 33 nodes: Supabase Storage download → PDF/DOCX/TXT extraction → chunking → Gemini 768-dim embeddings → Qdrant upsert with old-version cleanup. Live-verified for two CVs (exec 109); empty/image-only docs fail cleanly.
5. **Private upload path (12).** Team-password → n8n webhook → private Supabase bucket (`cv/`, `expertise/`, `project/`), path validation, async ingestion queue, live-verified.
6. **Authenticated read API (08).** Five `headerAuth` webhooks (leads, lead detail, jobs, knowledge documents); unauthenticated `GET /webhook/leads` correctly returns 403 (exec 83/84).
7. **Matching workflow exists with correct hygiene (05).** Qdrant filtered queries (`cv`/`project`/`stack`, strict `source: supabase_storage`), document-level dedup, evidence payloads carrying bucket/path. (Not yet run against a real lead.)
8. **Dashboard security posture is sound.** Zero `NEXT_PUBLIC_` usage; n8n API key only server-side; timing-safe password compare; upload route enforces HTTPS, path pinning, 4 MB cap, MIME + magic-byte checks, filename sanitization. Accessibility is notably strong (focus traps, ARIA, keyboard-activatable rows, reduced-motion).
9. **Honest progress discipline.** `Truth.md`/`Plan.md` refuse to mark gates passed without execution evidence; `docs/live-overview.md` records execution IDs and open blockers precisely. README states plainly that proposal generation is unfinished.
10. **Demo mode is a credible fallback.** LocalStorage adapter + static PPTX/PDF fixtures let the full UI be demoed without live services.

---

## 3. What is missing (by spec item)

### Phase 1 — MVP

| Spec item | Status | Gap |
|---|---|---|
| Lead & Tender Detection (15) | **Partial ~12/15** | Works live, but no jobs row on intake, no idempotency key, no dedup enforcement, no relevance rubric with reasons. |
| RAG Knowledge Retrieval (15) | **Partial ~10/15** | Ingestion live-verified; retrieval unverified end-to-end; no benchmark; corpus is 2 CVs vs. required 20 CVs + 15 projects + 3 stacks. |
| Agentic Prospect Research (10) | **Mostly missing ~2/10** | `02_prospect_research.json` has an Agent node but **no search/fetch tools connected**; no provider has passed a live run; it only records partial results from tender context. The core "autonomous research of sector/revenue/projects/partners/needs" is unbuilt. |
| n8n Orchestration (10) | **Partial ~6/10** | Chain exists (01 → 02 → 05) but no `07_job_runner`: no atomic claiming, leases, checkpoints, retries, or recovery. |
| Phase-1 deliverables | **Missing** | No architecture diagram / pipeline-flow doc in repo; no MVP video; no test suite. |

### Phase 2 — Integration & Testing

| Spec item | Status | Gap |
|---|---|---|
| Generative Presentation & Proposal Output (15) | **Missing 0/15** | `06_proposal_generation.json` absent; old workflow unpublished with placeholder rendering. No Slides template, no PPTX/PDF export, no artifact persistence. Dashboard blocks live generation with an error toast. **Largest single gap.** |
| RAG Benchmark & Retrieval Precision (10) | **Missing 0/10** | `11_rag_evaluation.json` absent; no labelled FR/EN queries, no hit@5/P@5/MRR artifacts, no evaluation report. |
| Edge Case & Data Validation (5) | **Partial ~3/5** | Upload validation and empty-doc rejection exist; no evidence of invalid/duplicate/concurrent intake tests or an error-handler workflow. |
| Phase-2 deliverables | **Missing** | No benchmark, no evaluation report, no test-suite results. |

### Phase 3 — UI/UX & Docs

| Spec item | Status | Gap |
|---|---|---|
| Dashboard (10) | **Partial ~6/10** | Leads list, matched-assets inspection, discovery, knowledge upload all work. Missing: **edit generated parameters** (explicitly in spec), **live deck download** (demo fixtures only), prospect-research review is a thin summary. Live mapper `lib/n8n-overview.ts` hardcodes requirement `status: "unknown"` and `coverage: null`, so matched results aren't actually surfaced. |
| Phase-3 deliverables | **Missing** | No technical report, no demo video. |

### Phase 4 & Bonus

- **Pitching (10):** no pitch deck or rehearsal artifacts in repo (an untracked `olive soft.pdf` exists; purpose unclear).
- **Bonus:** multi-format export — missing; requirements matrix — UI exists but live data not wired; competitor/budget agent — missing; human-in-the-loop editing — missing; multi-source crawler — **done** (TED/Tavily/SerpApi).

### Workflow inventory gaps (vs. `Truth.md` §3)

Missing exports: `00_intake`, `04_rag_search`, `06_proposal_generation`, `07_job_runner`, `09_actions`, `10_error_handler`, `11_rag_evaluation`, and the shared validator sub-workflow. `12_knowledge_upload` is still named "(draft)".

### Durability & safety gaps

No jobs population on intake, no idempotency/dedup, no lease/checkpoint/recovery, no error handler, no generate/retry/download actions. Replay safety — a stated non-cuttable requirement — is unproven.

---

## 4. Score estimate (my judgment, not the jury's)

| Phase | Estimate | Reason |
|---|---|---|
| Phase 1 (50) | ~30 | Detection and ingestion real; research agent and durability missing |
| Phase 2 (30) | ~3 | Proposal output and benchmark absent |
| Phase 3 (10) | ~6 | Good dashboard, missing 2 spec capabilities + deliverables |
| Bonus (10) | ~2 | Crawler done; matrix partial |
| **Total /100** | **~41** | |

---

## 5. Deadline risk

MVP deadline **Oct 1, 2026** — **2 days away**. The two biggest point blocks (proposal output 15 pts, RAG benchmark 10 pts) plus the research agent (10 pts) are exactly what's missing. Recommended cut order per `Truth.md` §8 is already being followed, but the core path (tender → research → match → proposal → download) cannot close in 2 days without the proposal workflow and a live research provider.

## 6. Top priorities to close the gaps

1. **Proposal generation (06)** — Slides template → copy → populate → export PPTX/PDF → persist stable file IDs. Unblocks 15 pts + 2 bonus + Gate C + dashboard downloads.
2. **Research tools (02)** — connect a bounded search/fetch provider to the existing agent; 5-organisation fixture run. Unblocks 10 pts.
3. **Job runner + actions (07/09)** — durable intake, idempotency, generate/retry/download. Unblocks orchestration points and replay safety.
4. **Benchmark (11)** — 10 labelled FR/EN queries, hit@5/P@5/MRR report. Unblocks 10 pts.
5. **Dashboard wiring** — surface real requirement status/coverage in `lib/n8n-overview.ts`; add parameter editing; replace demo downloads with authenticated artifact delivery.
6. **Deliverables** — architecture diagram, technical report, demo video, test fixtures.
