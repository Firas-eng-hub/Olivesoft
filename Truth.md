# OliveSoft — RFP Intelligence · Project Plan

> 📌 **Single source of truth for progress.** This page is updated via Notion MCP as work lands. Source of content: `plan-n8n.md` (2026-09-23, post-mentor-review).
**Deadlines:** MVP **Oct 1, 2026** · submission **Oct 19, 2026** · final package **Nov 1, 2026** (Dhiya to confirm against the official brief).
**Architecture rule:** all business logic lives in **n8n** — no FastAPI, no SQLAlchemy, no custom Python RAG or rendering backend. Short JS Code nodes and SQL are allowed.
> 

---

## 1. Overview

RFP intelligence pipeline: detect an IT tender → research its organisation → match requirements against internal CVs/projects/stacks → generate an evidence-backed commercial proposal with editable PPTX/PDF downloads.

- **State:** PostgreSQL (business data) · **Retrieval:** Qdrant + hosted multilingual embeddings
- **Documents:** Google Slides template + Drive exports (PPTX/PDF)
- **Interface:** n8n Forms first, thin Next.js dashboard later
- **Language rule:** deliverables in English · retrieval tested in FR and EN
- Pipeline status cycle: `detected → researched → matched → proposal_ready` (+ `failed`)

---

## 2. Team & Ownership

| Member | Branch | Primary responsibility | Supporting | Handoff deliverable |
| --- | --- | --- | --- | --- |
| **Dhiya** (lead) | `dhiya` | Intake, detection, state, jobs, orchestration, read/action webhooks, deployment | Integration, smoke checks, architecture, release | Valid tender + durable lead/job IDs |
| **Firas** | `firas` | Prospect research, proposal content, Slides template/export, artifact delivery | Research fixtures, demo narrative, proposal UI later | Cited prospect record + verified artifact manifest |
| **Nour** | `nour` | Internal fixtures, ingestion, embeddings, Qdrant, retrieval, requirement matching, benchmark | Evidence review, matches UI later | Versioned corpus + evidence-linked matches + coverage |

**Review rotation:** Dhiya reviews Firas · Firas reviews Nour · Nour reviews Dhiya. Lead review required before release merges. Everyone must be able to run the full demo.
**Git:** PRs from personal branch → `dev`; releases → `main`. `dev` must always pass the smoke test. One editor per n8n workflow at a time; export JSON to Git at session end.

---

## 3. Workflow Inventory

Status legend: ⬜ not started · 🟨 in progress · ✅ done

| # | Workflow export | Owner | Input → output | Status |
| --- | --- | --- | --- | --- |
| 00 | `00_intake.json` | Dhiya | Input + idempotency key → job ID (202) | ⬜ |
| 01 | `01_tender_detection.json` | Dhiya | Source input → tender + lead ID | ⬜ |
| 02 | `02_prospect_research.json` | Firas | Lead + organisation → prospect with citations | ⬜ |
| 03 | `03_knowledge_ingestion.json` | Nour | Document + metadata → index report | ⬜ |
| 04 | `04_rag_search.json` | Nour | Requirements + filters → evidence | ⬜ |
| 05 | `05_requirement_matching.json` | Nour | Lead → matches + coverage | ⬜ |
| 06 | `06_proposal_generation.json` | Firas | Lead + parameters → artifact manifest | ⬜ |
| 07 | `07_job_runner.json` | Dhiya | Queued job → completed/failed job | ⬜ |
| 08 | `08_read_api.json` | Dhiya | Queries → leads/jobs/artifacts | ⬜ |
| 09 | `09_actions.json` | Dhiya | Generate/retry → job ID | ⬜ |
| 10 | `10_error_handler.json` | Dhiya | Execution error → failure record | ⬜ |
| 11 | `11_rag_evaluation.json` | Nour | Golden queries → metrics | ⬜ |

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
- [ ]  Create a small Slides template: copy → replace placeholder → export PPTX/PDF → open both
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
- [ ]  Copy approved Slides template per generation version → populate via API → export PPTX/PDF → persist private stable file IDs
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
| Slides export blocked | Early copy/edit/export test; timebox another hosted renderer | Firas |
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
