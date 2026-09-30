# OliveSoft — RFP Intelligence · Project Plan

> 📌 **Single source of truth for progress.** This page is updated via Notion MCP as work lands. Source of content: `plan-n8n.md` (2026-09-23, post-mentor-review).
**Deadlines:** MVP **Oct 1, 2026** · submission **Oct 19, 2026** · final package **Nov 1, 2026** (Dhiya to confirm against the official brief).
**Architecture rule:** all business logic lives in **n8n** — no FastAPI, no SQLAlchemy, no custom Python RAG or rendering backend. Short JS Code nodes and SQL are allowed.
> 

---

## 1. Overview

RFP intelligence pipeline: detect an IT tender → research its organisation → match requirements against internal CVs/projects/stacks → generate an evidence-backed commercial proposal with editable PPTX/PDF downloads.

- **State:** PostgreSQL (business data) · **Retrieval:** Qdrant + hosted multilingual embeddings
- **Documents:** Approved alternative template + private PPTX/PDF exports (Google Drive/Slides ruled out)
- **Interface:** n8n Forms first, thin Next.js dashboard later
- **Language rule:** deliverables in English · retrieval tested in FR and EN
- Pipeline status cycle: `detected → researched → matched → proposal_ready` (+ `failed`)

---

## MVP implementation remaining (2026-09-28)

The October 1 MVP is **not yet verified**. The dashboard is connected to authenticated n8n read and manual intake routes. A manual tender was created and read back with a UUID. TED and Tavily discovery branches returned live suggestions in n8n, and the SerpApi fallback returned suggestions in a forced Tavily failure test; dashboard discovery still needs a hosted browser check. CV upload to private Supabase Storage, ingestion into Qdrant, and the saved Knowledge base list have succeeded live for two CVs. A filtered Qdrant read returned an indexed CV point. These checks do not prove the complete tender-to-proposal journey.

Complete the following in order. Keep an item open until its stated live check passes; an exported workflow or a successful isolated node is insufficient.

1. **Make manual tender intake durable and replay-safe (Dhiya).** Persist a job before acknowledging intake; add an idempotency key and database uniqueness so repeated or concurrent submissions return the same logical lead/job. Record stage, attempts, errors, and a checkpoint. Reject invalid and unauthorized requests with useful responses. **Pass:** valid, invalid, duplicate, and concurrent requests produce the expected lead/job records and no duplicate logical tender.
2. **Finish prospect research (Firas).** Connect a supported external search/fetch provider, resolve ambiguous organisation names, bound calls and timeouts, and save claim-level citations. Keep unknown facts null and allow a documented partial result when no useful source is found. The user authorized external tender/organisation search, but no provider has passed a live run. **Pass:** a new UUID lead advances from `detected` to `researched`; five organisation cases, including ambiguous and no-result cases, have supported claims and sensible failures.
3. **Complete and measure matching (Nour).** Run the published matching workflow on a researched UUID lead against the indexed CVs. Add project and expertise/stack fixtures, persist requirement-level judgments, evidence and coverage, and test re-indexing and no-match behavior. The Qdrant endpoint and required `source` filter index are configured; an actual lead-to-match run is still unverified. **Pass:** one lead reaches `matched` without manual database edits; relevant documents appear in the top five for at least 8 of 10 labelled positive FR/EN queries, while no-match cases create no invented support.
4. **Generate real proposal files (Firas).** Create an approved proposal template, instantiate it per generation version, populate it from the validated tender, cited prospect, and selected evidence, then export real PPTX and PDF files to private storage. Persist stable file IDs and verify both file contents before setting `proposal_ready`. The existing proposal workflow has placeholder rendering and is unpublished. **Pass:** open an editable PPTX and readable PDF for a matched lead; no unresolved tags, unsupported team/reference claims, or duplicate artifact bundle on retry.
5. **Connect actions, retries, and downloads (Dhiya).** Add authenticated generate/retry endpoints and durable job runner with lease/checkpoint recovery. Show job progress and failure in Activity; provide authenticated artifact lookup and controlled downloads. The current jobs read route works, but intake does not populate jobs and generate/retry/download actions are absent. **Pass:** request generation, poll to completion, download both files, retry a failed stage, and resume after interruption without duplicate leads or artifacts; unauthorized requests fail.
6. **Run the full release gate (all).** Rebind credentials after clean import, exercise the dashboard flow from new tender through research, matching, proposal request and both downloads, and record n8n execution IDs and artifact checks. Include invalid input, duplicate/replay, missing evidence, provider failure and export failure. Keep `proposal_ready` unavailable if either export fails. **Pass:** Gate A connectivity and actual PPTX/PDF opening, plus Gate C complete user journey, are recorded with live evidence.

Keep scheduled tender discovery, more feeds, OCR, extra dashboard polish, and broader corpus evaluation behind this core path unless the official brief makes one mandatory. The existing [live overview](docs/live-overview.md) and [Knowledge base notes](docs/supabase-knowledge.md) contain the individual checks completed so far.

---

## 2. Team & Ownership

| Member | Branch | Primary responsibility | Supporting | Handoff deliverable |
| --- | --- | --- | --- | --- |
| **Dhiya** (lead) | `dhiya` | Intake, detection, state, jobs, orchestration, read/action webhooks, deployment | Integration, smoke checks, architecture, release | Valid tender + durable lead/job IDs |
| **Firas** | `firas` | Prospect research, proposal content, proposal template/export, artifact delivery | Research fixtures, demo narrative, proposal UI later | Cited prospect record + verified artifact manifest |
| **Nour** | `nour` | Internal fixtures, ingestion, embeddings, Qdrant, retrieval, requirement matching, benchmark | Evidence review, matches UI later | Versioned corpus + evidence-linked matches + coverage |

**Review rotation:** Dhiya reviews Firas · Firas reviews Nour · Nour reviews Dhiya. Lead review required before release merges. Everyone must be able to run the full demo.
**Git:** PRs from personal branch → `dev`; releases → `main`. `dev` must always pass the smoke test. One editor per n8n workflow at a time; export JSON to Git at session end.

---

## 3. Workflow Inventory

Status legend: ⬜ not started · 🟨 in progress · ✅ done

| # | Workflow export | Owner | Input → output | Status |
| --- | --- | --- | --- | --- |
| 00 | `00_intake.json` | Dhiya | Input + idempotency key → job ID (202) | 🟨 |
| 01 | `01_tender_detection.json` | Dhiya | Source input → tender + lead ID | 🟨 |
| 02 | `02_prospect_research.json` | Firas | Lead + organisation → prospect with citations | 🟨 |
| 03 | `03_knowledge_ingestion.json` | Nour | Document + metadata → index report | 🟨 |
| 04 | `04_rag_search.json` | Nour | Requirements + filters → evidence | 🟨 |
| 05 | `05_requirement_matching.json` | Nour | Lead → matches + coverage | 🟨 |
| 06 | `06_proposal_generation.json` | Firas | Lead + parameters → artifact manifest | 🟨 |
| 07 | `07_job_runner.json` | Dhiya | Queued job → completed/failed job | 🟨 |
| 08 | `08_read_api.json` | Dhiya | Queries → leads/jobs/artifacts | 🟨 |
| 09 | `09_actions.json` | Dhiya | Generate/retry → job ID | 🟨 |
| 10 | `10_error_handler.json` | Dhiya | Execution error → failure record | 🟨 |
| 11 | `11_rag_evaluation.json` | Nour | Golden queries → metrics | 🟨 |
| 12 | `12_knowledge_upload.json` | Firas / Nour | Private upload → saved document + ingestion request | 🟨 |
| 13 | `13_tender_discovery.json` | Dhiya | TED/Tavily search → reviewable tender suggestions | 🟨 |

**Shared sub-workflow envelope:** `{schema_version, job_id, lead_id, operation, input, result, warnings}` — preserve it; return one explicit result object.
**Contract rules:** stable requirement IDs & `asset_ref`; claim-level evidence (URL, title, timestamp, claim, excerpt); unknown budget/deadline stays `null`; artifact identity = stable provider file ID, never an expiring link; limits: upload 5 MB, top_k 5–20, list 50–100; validate with a reusable validator sub-workflow (don’t assume npm imports work in Code nodes).

---

## 4. Phase A — Foundations & Feasibility (day 1)

### Dhiya

- [ ]  Confirm official deadlines, deliverables, and any mandatory hybrid-RAG requirement
- [ ]  Prove team access/permissions on the Azure n8n instance (fallback: separate dev instances + controlled importer; never share owner passwords)
- [ ]  Record n8n version, base URL, service locations, workflow IDs, credential names, backup process in `docs/n8n-setup.md`
- [ ]  Prove deployed n8n → PostgreSQL read/write and → Qdrant connectivity
- [ ]  Build an authenticated test webhook + a parent/sub-workflow pair; export/import, document credential rebinding
- [ ]  Draft versioned migrations for jobs, provenance, uniqueness; test on a disposable database

### Firas

- [ ]  Prove structured chat from n8n (model access, quotas, cost) — coding-plan credentials are NOT assumed to cover embeddings/automation
- [ ]  Prove search + source retrieval with a supported provider
- [ ]  Create a small approved template: instantiate → replace placeholder → export PPTX/PDF → open both
- [ ]  Record OAuth scopes, account access, private output-folder config (if blocked: timebox another hosted renderer — do NOT silently build a custom backend)

### Nour

- [ ]  Choose one multilingual embedding API; record model, dimensions, distance metric, limits, cost estimate
- [ ]  Index 3 documents and retrieve the expected one in French and English
- [ ]  Prove plain-text/Markdown and text-based PDF extraction (DOCX/OCR = separate adapters until tested)
- [ ]  Deliver 2 CVs, 2 projects, 1 stack profile, 1 tender with expected matches

**🚪 Gate A:** all three run their workflows and import exports · connectivity works · actual PPTX/PDF files open. Rendering blocked → continue core MVP but report export as blocked, never complete.

---

## 5. Phase B — Build the Core in Parallel

### Dhiya — detection & orchestration

- [ ]  Accept canonical JSON first, then CSV/text-based PDF; reject unsupported formats clearly
- [ ]  Authenticate + validate transport; persist job BEFORE returning `202 {job_id, status:"queued"}` — never acknowledge success if persistence failed
- [ ]  Extract tender fields; validate structured output; retry malformed model output once, then fail with a useful error
- [ ]  Deduplicate by source + external ID, fallback to normalized content hash; enforce uniqueness in PostgreSQL
- [ ]  Define transparent relevance rubric (IT fit, capabilities, constraints); save reasons; unknown ≠ invented fact
- [ ]  Chain detection → research → matching with durable checkpoints; generation requires explicit request (or demo auto-gen setting)
- [ ]  Provide paginated lead list/detail, job state, artifact lookup
- [ ]  Add one scheduled source adapter with checkpoint once manual intake works

**✅ Acceptance:** 10 tenders incl. duplicate/invalid → expected records/errors · replays create no duplicates · one lead reaches `matched` without manual DB edits.

### Firas — prospect research

- [ ]  Agent with search/fetch tools; resolve correct organisation before researching lookalikes
- [ ]  Bounds: 3 search calls, 5 page fetches, 5 agent iterations per lead; provider timeouts set
- [ ]  Web text = evidence, not instructions; public HTTPS only; reject private/local targets, unsafe redirects
- [ ]  Extract sector, documented projects/partners, relevant needs; unsupported revenue stays `null`; estimates labeled
- [ ]  Validate final output OUTSIDE the agent step; store claim-level evidence, timestamps, warnings
- [ ]  No useful results → minimal `partial: true` record; matching continues; missing evidence ≠ provider failure

**✅ Acceptance:** 5 organisations incl. 1 ambiguous name + 1 with no results · every factual claim supported · nothing fabricated during an outage.

### Nour — ingestion, RAG & matching

- [ ]  Create 20 synthetic CVs, 15 project summaries, ≥3 stack profiles with stable IDs + deliberate skill mismatches
- [ ]  Fetch from controlled storage; extract text; reject empty/image-only input; normalize metadata; keep source references
- [ ]  Recursive character splitting ~1,500 chars / 200 overlap; record units; tune via evaluation; keep page/section refs
- [ ]  Deterministic vector point IDs (doc ID/version/chunk); re-ingestion never inflates counts; replace obsolete chunks
- [ ]  Start with 1 collection + `asset_type` payload filters; same model/dimensions for indexing and queries
- [ ]  Search per requirement; over-fetch; deduplicate by document; keep strongest evidence; distinguish CV vs project
- [ ]  Support classes: supported=1, partial=0.5, unsupported=0, unknown=null; validate model judgments vs human labels
- [ ]  Coverage = `100 × Σ(support, unknown=0) / requirement_count`, equal weights; show unknown count; mandatory unsupported/unknown → review
- [ ]  Keep raw similarity separate from coverage — neither is a win probability nor proof of availability
- [ ]  Build 10 labelled FR/EN positive queries + ≥2 no-match cases → expand to 30 (exact terms + paraphrases)

**✅ Acceptance:** known relevant docs in top-5 for ≥8/10 positive queries · no-match cases produce no invented recommendations · full results + evidence persisted · re-indexing creates no duplicates.

**Baseline note:** dense retrieval is the baseline. If exact terms are missed → PostgreSQL full-text + reciprocal-rank fusion; hosted reranker only after access is proven. If the brief mandates hybrid for the MVP → required gate.

---

## 6. Phase C — Proposal & Complete User Journey

### Firas

- [ ]  Assemble context from validated tender + cited prospect + selected matches + coverage + parameters (never the whole corpus)
- [ ]  Generate structured content for 7–9 slides: cover, executive summary, requirements, approach, team, references, delivery assumptions, commercial assumptions, next steps
- [ ]  Matched staff = candidates subject to availability — no invented rates/budgets/certifications/outcomes
- [ ]  Enforce slide text limits; retain evidence; flag business gaps; review weak-coverage proposals
- [ ]  Instantiate approved template per generation version → populate via API → export PPTX/PDF → persist private stable file IDs
- [ ]  Save template-copy ID before continuing (retries reuse it); keep versioned artifacts
- [ ]  Check nonempty files/MIME; open PPTX in PowerPoint; inspect PDF pages, long titles, bullets, multilingual text

### Dhiya

- [ ]  Generate/retry actions with preconditions + dedup (same key → same logical job)
- [ ]  Downloads via authenticated workflows / controlled storage — never an expiring link as identity
- [ ]  Expose job progress + partial/failed states; poll jobs, never hold HTTP open through AI/rendering

### Nour

- [ ]  Check team/reference claims against evidence on 5 proposals
- [ ]  Produce requirement matrix (supported/partial/unsupported/unknown + source links)
- [ ]  Expand evaluation to 30 queries; compare dense vs improved retrieval on the same corpus

**🚪 Gate C:** submit tender → inspect research/matches → request proposal → download editable PPTX/PDF. No unresolved template tags, no fabricated references, no duplicated artifact bundles. Either export failing ⇒ bundle is NOT `proposal_ready`.

---

## 7. Data Model & Recovery (summary)

- Extend existing business tables via migrations; `db/init.sql` only initializes a FRESH database — never reset shared volumes to migrate.
- Add: **jobs** (UUID, idempotency key, state, stage, attempts, lease expiry) · **knowledge** (doc/source/hash, versions) · **artifacts** (stable file ID, MIME, unique job+kind).
- Persist stage output + status update in ONE transaction; Postgres nodes don’t share transactions automatically.
- Recovery: persist-before-acknowledge · atomic job claiming (low concurrency) · leases/checkpoints + stale-job sweep · transient failures retried ≤3 with backoff · resume from last durable stage · failures updated in the runner itself.
- Webhook base: `https://<host>/webhook/olivesoft/v1` — published production URLs only (editor test URLs are not deployed endpoints).
- Errors: `{code, message, job_id}` with proper 400/401/403/404/409/422/503.

---

## 8. Calendar & Gates

| Date | Dhiya | Firas | Nour | Gate |
| --- | --- | --- | --- | --- |
| Sep 24 | Intake + detection | Research + citations | Corpus + ingestion | Independent workflows |
| Sep 25 | Runner + read endpoints | Research limits/fallbacks | Retrieval + matching | First detected → matched lead |
| Sep 26 | Recovery/dedup | Proposal schema/template | Ten-query benchmark | Repeatable core |
| Sep 27 | Source adapter/integration | First proposal export | Coverage/re-ingestion | Evidence-backed happy path |
| Sep 28 | Failure/concurrency checks | Layout/export checks | Retrieval regressions | MVP feature freeze |
| Sep 29 | Architecture/release rehearsal | Demo narrative/artifacts | Benchmark/workflow notes | Clean import rehearsal |
| Sep 30 | Release/submission | Record/inspect demo | Verify delivery package | Submit with buffer |
| Oct 1 | Contingency only | Contingency only | Contingency only | **MVP deadline** |
| Oct 2–19 | Remaining exports, evaluation, interface, report + video — freeze Oct 18, submit Oct 19 |  |  |  |
| Oct 21–31 | Edge cases, polish, docs, clean-deploy rehearsal, pitch — package Oct 31 |  |  |  |

**Oct 1 minimum:** detection · agentic research · measured RAG · n8n orchestration · exports · architecture + short demo. Cut order if slipping: dashboard polish → extra feeds → OCR → local models → slide editing. NEVER cut: evidence, basic validation, replay safety.

---

## 9. Tests & Definition of Done

| Test | Owner | Pass condition |
| --- | --- | --- |
| Extraction | Dhiya | Schema-valid results; explicit invalid-input behavior |
| Concurrent/repeated intake | Dhiya | 1 lead/logical job per unique key |
| Research evidence | Firas | Claims supported; unknowns stay unknown |
| Re-ingestion/update | Nour | No duplicate chunks; obsolete removed |
| Retrieval | Nour | P@5 / MRR / hit-rate reported; hit@5 ≥ 8/10 initially |
| No matches | Nour | No forced endorsements / fabricated evidence |
| Proposal grounding | Firas + Nour | Team/references supported by approved sources |
| Export | Firas | Editable PPTX, readable PDF, no clipping/template tags |
| Outage/restart | Dhiya | Durable resumable jobs; no lost/duplicated work |
| Access control | Dhiya | Unauthorized actions rejected; no secrets exposed |
| Clean import | All | Rebind credentials/IDs; fixtures pass |

**Measurement:** for 10 representative jobs record per-stage latency, model/search calls, cost, failures. Targets: < 2 min to `matched`, < 3 min more to export (soft). Agree a daily spend ceiling; cap loops/retries/concurrency.
**Done =** export + contract + passing/failing fixtures + credential mapping + run instructions + review. A screenshot is not a deliverable.

---

## 10. Risks & Fallbacks

| Risk | Response | Owner |
| --- | --- | --- |
| Missing provider access/quotas | Day-one proof, fallback provider, documented costs | Firas / Nour |
| Renderer export blocked | Early populate/export test; timebox another hosted renderer | Firas |
| n8n sharing restrictions | Separate dev instances + controlled integration importer | Dhiya |
| Services only on a laptop | Fix reachable deployment before dependent work | Dhiya |
| Dense retrieval misses exact terms | Evaluate → lexical fusion/rerank; report real improvement | Nour |
| Invented business claims | Claim-level sources, bounded tools, unknowns, review | Firas |
| Live demo outage | Labelled recorded run + existing artifacts; replay ≠ live | All |
| First deadline overload | Protect core pipeline; defer optional sources/OCR/polish | Dhiya |

---

## 11. Migration Backlog (old FastAPI repo → all-n8n)

- [ ]  Replace old README/setup and `explication.txt` architecture content; align guidance with n8n development
- [ ]  Rewrite `docs/api.md` around authenticated async webhooks; retire obsolete FastAPI contract
- [ ]  Update deployment/Compose to chosen service locations; retire API/ngrok dependency once n8n health/intake works
- [ ]  Archive/remove unused `api/` in a separate reviewed change (preserve local edits)
- [ ]  Add workflow/prompt, migration, fixture, evaluation, template directories as implementations land
- [ ]  Replace API-centered smoke script with n8n readiness + DB round trip + retrieval + job completion + artifact checks
- [ ]  Update `.env.example` and credential mapping with placeholders (host settings vs n8n credentials vs workflow config)
- [ ]  Firas documents template version/folder permissions/regeneration · Nour documents corpus/model versions + rebuild/evaluation

---

## 12. Keeping This Page Up to Date (MCP conventions)

1. **Check off** tasks: `[ ]` → `[x]` as soon as work is reviewed — not before.
2. **Workflow table:** update the Status column (⬜/🟨/✅) whenever an export is created, imported, or validated.
3. **Session log:** append one bullet per work session at the bottom (date · member · what moved · blocker).
4. **Gate status:** when a gate passes, add ✅ and the date next to the gate line.
5. Never delete history — mark superseded items with ~~strikethrough~~ and a note.

### Session Log

- 2026-09-23 — plan rewritten post-mentor-review (`plan-n8n.md`); architecture pivoted to all-n8n.
- 2026-09-28 — Updated MVP remaining work after live CV upload, indexing, document-list, and filtered Qdrant checks; tender-to-proposal release gates remain open.
- 2026-09-29 — Baseline manual n8n execution 193 rejected a synthetic tender with 422 because the published intake requires explicit requirements. Executions 194 → 195 → 196 created lead `d29d2eb0-f781-4db4-aab8-45d50ebd035a` and advanced it to `matched`. Research was partial with no public citations; matching saved document scores, not requirement judgments. Drafted additive migration `006_pipeline_jobs.sql`, credential-free intake/runner/search/retry exports, a bounded search/citation validator, conservative requirement rows, authenticated download contract, and dashboard async intake/retry support. Migration application, workflow import/publication, disposable-database checks, search citations, measured RAG, real proposal exports, and peer review remain open; no release checklist item was marked done.
- 2026-09-28 — Published TED and Tavily tender discovery in n8n and added a dashboard review path. SerpApi fallback was later bound and passed a forced Tavily failure test; hosted dashboard smoke check remains open.
- 2026-09-30 — Generated the synthetic knowledge corpus fixtures in `fixtures/corpus/` from `data/synthetic_data.json` via the new deterministic `dashboard/scripts/generate_corpus.py`: 20 CVs + 15 projects + 3 capability stacks (27 FR / 11 EN; 30 PDF / 6 TXT / 5 DOCX), 3 v2 variants (C02, P04, STK-01) for the re-indexation test, 3 test tenders with an expected match matrix, and 10 labelled FR/EN queries plus 3 no-match cases. Static checks pass: every document is extractable with an ID/version/asset_type header, all label references resolve to existing corpus IDs, coverage math in the matrix is consistent, and no-match zones (React, Kubernetes, SAP S/4HANA) stay absent. Live upload, ingestion, benchmark run, and matching verification remain open.

**Known accessibility debt (dashboard UI, 2026-09-29):** the following muted text colors fall below WCAG AA contrast versus their panel backgrounds (computed ratios in parentheses) - `#606a7e` (3.23), `#647087` (3.37), `#67728a` (3.39), `#667186` (3.58), `#626e86` (3.69), `#616d82` (3.73), `#67758a` (3.76), `#6f7b90` (3.94), `#69758b` (3.96), `#6e798d` (4.00), `#717e92` (4.08), `#758095` (4.11) - accepted by owner - theme frozen. Typography floor applied instead: no rendered text below 11px uppercase / 12px sentence case.
- 2026-09-29 - Dashboard remediation phases 1-8 landed on dhiya (8 commits): keyboard/focus correctness (Escape, focus trap+restore, Space on rows, working Cmd/Ctrl+K), persistent sticky sidebar >1050px with drawer+scrim <=1050px and hover-reveal removed, stage select replaced by sort toggle + visible filter chips, error-tone toasts + honest bell dot + disabled orphan rows + removed fake affordances (stat-menu arrow, top-avatar), modal inline validation hints + prefill-trim notes, icon system normalized to 16/20/24/32 grid with honest glyphs (Globe/RotateCcw/Layers/Command/ArrowDown), typography floor 11px uppercase / 12px sentence with density compensation, font preconnect, demo fallback on status-check failure, fixed artifact names, generate progress on trigger buttons, localStorage save guard. Verified per phase: 
pm run typecheck clean + color-freeze token audit (no color value added/removed except pre-approved var(--red) toast glyph, drawer box-shadow relocation, and G7 verbatim copies for new UI). Browser walk (viewports 375-1440, keyboard script, reduced-motion) pending visual verification.
- 2026-09-29 — Continued draft work: linked per-requirement RAG search and quoted LLM judgments to a transactional matrix writer; added a ten-query FR/EN retrieval benchmark export. Static JSON/JavaScript checks and dashboard typecheck pass. The user ruled out Google Drive/Slides and identified Supabase as the intended disposable database location; database access, live import, benchmark evidence, renderer selection, and peer review remain open. No release checklist item was marked done.

- 2026-09-29 — Continued implementation in this session: added a Vercel proposal renderer using PptxGenJS and pdf-lib, explicit generate action, proposal runner branch, separate research/matching checkpoints, error handler, and persisted RAG benchmark metrics. Migration 006 passed in a disposable PostgreSQL 16 database with intake replay, prospect replay, fencing, quoted requirement judgments, proposal replay, and two-artifact finalization assertions. A read-only Supabase schema check matched the required leads/prospects/matches columns. Local renderer tests opened PPTX/PDF output and rejected unsupported claims. None of these new exports is deployed; Supabase migration, Vercel renderer deployment, production webhook runs, retrieval threshold, downloads, end-to-end journey, and peer review remain open.

- 2026-09-29 — Imported the reusable `04_rag_search` as an unpublished Azure n8n draft (`xQWRueCw6zpLkfCT`). Manual execution 249 ran ten labelled FR/EN project queries with throttled embedding/Qdrant requests: expected documents ranked first in all ten (hit@5 10/10). This satisfies the retrieval metric only; no-match judgments, new-lead matching, persisted evaluation, proposal exports, full journey, and peer review remain open.

- 2026-09-29 — Applied migration 006 to Supabase in one transaction after disposable PostgreSQL tests and read-only schema comparison; readback found eight tables and eight functions. Imported `00_intake` as an unpublished n8n draft (`HLRFqAAfEMRXhFbw`). Manual executions 250–253 covered invalid input, a new queued UUID lead/job, identical replay returning the same IDs, and conflicting replay. Production authentication and `202`/`409` HTTP delivery still require published webhook checks. Vercel renderer deployment and peer review remain open; no release checklist item was marked done.

- 2026-09-29 — Published reusable `04_rag_search`; imported `11_rag_evaluation` as a draft (`HEZQc2ELKZTASdGb`). Execution 254 persisted ten labelled FR/EN queries at 10/10 hit@5 (evaluation run `ee2f3f5d-96f1-4854-88db-9befda2dfc4b`). Imported and published shared `10_error_handler` (`3qyIiBfrSWIGE0PD`), which is not yet linked or failure-tested. Matching judgments and the full journey remain open; no release checklist item was marked done.

- 2026-09-29 — Imported `02_prospect_research` as an unpublished draft (`qcN9uUV2kKWmfsO7`). Its new no-result branch avoided unsupported external claims on lead `bf42ab26-d132-4517-91cb-fe5d0be3d249`: integrated execution 261 persisted a partial prospect with null sector/revenue, empty projects/partners/citations, and moved the lead to `researched`. Execution 257 found the GLM provider usage limit, which prevents a cited-source test until the provider resets. Matching, proposal exports, downloads, and peer review remain open.

- 2026-09-29 — Imported `05_requirement_matching` as unpublished draft `9RXlfrAqDJlMfke0` with quoted matrix persistence and failure branches; live judgments await the GLM usage reset. Created and read back private Supabase Storage bucket `olivesoft-proposals` with PDF/PPTX MIME and 2 MB limits (n8n executions 263–264). The new Vercel renderer project initially returned `FUNCTION_INVOCATION_FAILED`; its logs identified the PptxGenJS ES module entry as the cause. Switched to the CommonJS entry and passed local renderer tests. Redeployment, the renderer credential, live exports, and peer review remain open.
- 2026-09-29 — Confirmed n8n credential `OliveSoft Proposal Renderer` (`EgCydNrPSXFpDJ0y`) and imported proposal generation draft `WZmKWIoyOeqKEdbn` with renderer and private storage credentials bound. The runner export now references research `qcN9uUV2kKWmfsO7`, matching `9RXlfrAqDJlMfke0`, and proposal `WZmKWIoyOeqKEdbn`. Authenticated renderer execution is still pending because the execution service usage limit blocked the smoke run; no release checklist item was marked done.
- 2026-09-30 — Fixed the broken merge that blocked Vercel: commit `Merge main into dhiya` had landed `dashboard/components/Dashboard.tsx` (and a Truth.md session-log block) with unresolved conflict markers, so `npm run build` failed on main (TS1185). Resolved semantically: kept the accessibility work (focus trap, touched-field validation, toasts as `{message, tone}` objects, sort toggle + filter chips, 16/20/24/32 icon grid) and re-grafted the live-mode features (5s polling, intake idempotency keys, POST `/api/actions/generate` + `/api/actions/retry`, `downloadSelected` via `/api/artifacts/[id]`, requirements textarea in the intake modal, live-aware `ProposalPreview`). `npm run typecheck` and `npm run build` pass locally. Live generate/retry/download paths still need a recorded live run before any gate is checked; peer review of the resolution pending.
