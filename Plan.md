# OliveSoft — Missing Work and Implementation Plan

Review date: **2026-09-25**  
Target: **all business logic in n8n**, PostgreSQL for state, Qdrant for retrieval, a renderer approved for proposals (Google Drive/Slides ruled out by the user). Short JavaScript Code nodes and SQL are allowed. FastAPI, SQLAlchemy, and custom Python RAG/rendering backends are excluded from the target architecture.

Deadlines from the supplied project plan: MVP **October 1, 2026**, submission **October 19**, final package **November 1**. Dhiya must confirm these against the official brief.

## 1. Review scope and current state

This backlog is based on the preceding static review of [dhiyaeddineelgabsi/olivesoft](https://github.com/dhiyaeddineelgabsi/olivesoft), primarily `dev` at commit `53f40867b90c78219ffcf1976ec074337c050a1e`. Personal branches were inspected for file inventory only. The local workspace had no checkout; tests and live n8n/database executions were not run. Changes made after that reviewed commit are not covered.

**Current conclusion: partial implementation using the previous architecture. The supplied all-n8n plan is not yet implemented.**

| Area | Observed evidence | Work still required |
|---|---|---|
| n8n exports | `00_test.json`, `02_prospect_research.json`, `04_proposal_generation.json` exist on `dev` | Implement the missing inventory below and migrate proposal generation |
| Research | Workflow, JS, SQL, prompt, and fixture tests exist; documentation describes Wikipedia-only research | Add bounded agent search/fetch, shared contracts, and verify deployed execution |
| Proposals | n8n calls a FastAPI renderer using local PPTX/PDF files | Move generation orchestration and persistence into n8n; use verified PPTX/PDF exports in private storage |
| Jobs | `generation_jobs` and proposal actions exist in the API | Add general intake/action jobs, idempotency, checkpoints, leases, recovery, and runner |
| Retrieval | Python RAG modules and evaluation files exist on `nour`; corresponding n8n exports are absent from `dev` | Implement ingestion, retrieval, matching, and evaluation in n8n |
| Access | Public generation, status, lead detail, and artifact routes lack authentication in the inspected API | Replace with authenticated n8n routes and controlled downloads |
| Database | Business tables and migrations `004`/`005` exist | Add uniqueness, provenance, knowledge versions, durable jobs, and provider artifact identities |
| Deployment/docs | Compose, README, API contract, and smoke script describe the previous API architecture | Align them with the deployed n8n design and prove connectivity |
| Gates | Documentation explicitly records unverified hosted connectivity | Gate A and Gate C remain **unverified**, not passed |

Existing fixture tests and exports are useful starting points. Their presence does not establish runtime correctness, import success, or reviewed completion. No task below is checked off solely because a file exists.

## 2. Priorities and ownership

| Priority | Outcome | Owner |
|---|---|---|
| P0 | Confirm provider access, hosted connectivity, and a real PPTX/PDF export | Dhiya / Firas / Nour |
| P0 | Freeze shared contracts and apply safe database migrations | Dhiya, reviewed by Firas and Nour |
| P0 | Accept a tender durably and run detection → research → matching | Dhiya with Firas and Nour |
| P0 | Produce measured retrieval and evidence-linked requirement coverage | Nour |
| P0 | Generate and privately deliver editable PPTX and readable PDF | Firas with Dhiya |
| P0 | Prove authentication, replay safety, recovery, and clean import | All |
| P1 | Scheduled tender source, expanded evaluation, documentation, and demo package | All |
| P2 | Dashboard polish, extra feeds, OCR/DOCX adapters, and optional reranking | After core gates |

Review rotation: Dhiya reviews Firas; Firas reviews Nour; Nour reviews Dhiya. Lead review is required before release merges. Preserve local edits and existing work during migration.

## 3. Required workflow inventory

Use the supplied filenames consistently in exports, documentation, imports, and workflow ID mapping.

| Export | Owner | Current gap / required implementation |
|---|---|---|
| `00_intake.json` | Dhiya | Missing; authenticate, validate, persist a job, then return HTTP 202 |
| `01_tender_detection.json` | Dhiya | Missing; extract/validate tender, deduplicate, score relevance, persist lead |
| `02_prospect_research.json` | Firas | Exists; adapt its contract and research behavior, then validate on hosted n8n |
| `03_knowledge_ingestion.json` | Nour | Supabase Storage draft; PDF/DOCX/TXT extraction and Qdrant indexing, live gate pending |
| `04_rag_search.json` | Nour | Missing; requirement search with filters, document deduplication, and evidence |
| `05_requirement_matching.json` | Nour | Supabase-sourced Qdrant draft; support judgments and coverage still pending live gate |
| `06_proposal_generation.json` | Firas | Replace/adapt current `04_proposal_generation.json`; use the Vercel PptxGenJS/pdf-lib formatter with n8n-owned content and persistence |
| `07_job_runner.json` | Dhiya | Missing; atomic claiming, stage execution, checkpointing, retries, recovery |
| `08_read_api.json` | Dhiya | Missing; authenticated paginated leads, details, jobs, and artifact lookup |
| `09_actions.json` | Dhiya | Missing; explicit generation/retry actions with preconditions and idempotency |
| `10_error_handler.json` | Dhiya | Missing; record execution failures; runner must also persist its own failures |
| `11_rag_evaluation.json` | Nour | Missing; run labelled FR/EN queries and persist benchmark metrics |
| `12_knowledge_upload.json` | Firas / Nour | Draft; platform upload to private Supabase Storage, then durable ingestion and index status |
| `13_tender_discovery.json` | Dhiya | Existing manual TED/Tavily suggestion endpoints; retained until automatic discovery passes live checks |
| `14_opportunity_scan.json` | Dhiya / Nour | Daily TED and Tavily scan, GLM extraction of quoted requirements, staging, deduplication, and durable intake |
| `15_opportunity_api.json` | Dhiya | Authenticated saved-opportunity list, candidate review, and acceptance with comments |
| Reusable validator sub-workflow | Shared | Missing; validate shared input/output schemas without assuming npm imports |

`00_test.json` is an echo test, not intake. It currently has no webhook authentication and must not be counted as the authenticated feasibility test.

## 4. P0 — Foundations and provider feasibility

### Dhiya

- [ ] Confirm official deadlines, required deliverables, and whether hybrid RAG is mandatory for MVP.
- [ ] Confirm each member can access/import workflows on the hosted n8n instance without sharing owner passwords.
- [ ] Create `docs/n8n-setup.md`: n8n version, production base URL, service locations, workflow IDs, credential names, rebinding, and backup/restore process.
- [ ] Prove hosted n8n → PostgreSQL read/write and hosted n8n → Qdrant connectivity.
- [ ] Prove an authenticated production webhook and a parent/sub-workflow pair; export and re-import both.
- [ ] Document separate host settings, n8n credentials, and workflow configuration in `.env.example` and setup guidance.

### Firas

- [ ] Prove structured chat access, supported search/fetch, quotas, and per-call costs from n8n.
- [ ] Verify automation credentials independently; do not assume coding-plan credentials cover this usage.
- [ ] Choose an approved proposal template and private output store; Google Drive/Slides are ruled out.
- [ ] Prove template population → export PPTX/PDF → open both files.
- [ ] Document OAuth scopes, template version, folder permissions, and regeneration procedure.

### Nour

- [ ] Choose and record a hosted multilingual embedding model, dimensions, distance metric, limits, and estimated cost.
- [ ] Index three documents and retrieve the expected document using French and English queries.
- [ ] Prove text/Markdown and text-based PDF extraction; reject image-only/empty content clearly.
- [ ] Supply an initial fixture set: two CVs, two projects, one stack, one tender, and expected matches.

**Gate A:** all members can import/run their workflows, connectivity is proven, and real PPTX/PDF files open. If rendering is blocked, record that blocker and continue core work without marking export complete.

## 5. P0 — Shared contracts and database migrations

Owner: **Dhiya**, with all owners validating their handoff payloads.

- [ ] Standardize the sub-workflow envelope: `{schema_version, job_id, lead_id, operation, input, result, warnings}`. Preserve it and return one explicit result object.
- [ ] Add stable requirement IDs and stable `asset_ref` values; keep document identity distinct from individual vector chunk IDs.
- [ ] Define claim evidence with URL, title, retrieval timestamp, claim, and supporting excerpt. Preserve page/section references for internal evidence.
- [ ] Keep unknown budget/deadline/revenue values `null`; separate documented facts from labelled estimates/inferences.
- [ ] Validate transport and contracts; enforce upload ≤5 MB, `top_k` 5–20, and list bounds of 50–100.
- [ ] Standardize HTTP errors as `{code, message, job_id}` with appropriate 400/401/403/404/409/422/503 responses.
- [ ] Add general `jobs`: UUID, operation, scoped idempotency key, input, state, stage, attempts, next retry time, lease expiry, error, timestamps, and durable stage results.
- [ ] Define same-key behavior: identical requests reuse the logical job; conflicting payloads return 409.
- [ ] Enforce database uniqueness for job idempotency and tender source/external ID, with normalized content hash fallback.
- [ ] Add knowledge document/source/hash/version metadata and ingestion state.
- [ ] Extend artifacts with job/version, kind, MIME, stable provider file ID, and uniqueness on job + kind.
- [ ] Persist the selected renderer template identity before population/export so retries reuse it.
- [ ] Persist each stage output and its status update in one database transaction; separate Postgres nodes do not automatically share transactions.
- [ ] Test migrations against a disposable database and an existing-schema fixture. Do not reset shared volumes.
- [ ] Remove the destructive reinitialization instruction from `db/init.sql`; provide explicit migration commands instead.

**Acceptance:** concurrent duplicate intake cannot create duplicate logical jobs/leads; schema upgrades preserve existing data; transaction failures leave no partially advanced stages.

## 6. P0 — Intake, detection, runner, and endpoints

Owner: **Dhiya**.

- [ ] Accept canonical JSON first; add CSV and text-based PDF adapters after JSON works. Reject unsupported formats explicitly.
- [ ] Authenticate and validate intake, persist the job, then return `202 {job_id, status:"queued"}`. Persistence failure must not receive a success acknowledgement.
- [ ] Extract and validate tender fields; retry malformed model output once, then fail with a useful diagnostic.
- [ ] Deduplicate tenders and record a transparent relevance rubric with reasons.
- [ ] Run detection → research → matching using durable stage checkpoints.
- [ ] Require an explicit proposal-generation request unless a documented demo auto-generation setting is enabled.
- [ ] Claim queued jobs atomically, set leases, renew them when needed, and prevent concurrent workers from advancing the same job.
- [ ] Add a stale-job sweep, transient retries capped at three with backoff, and resume from the last durable stage.
- [ ] Prevent an expired worker from overwriting the current worker's result.
- [ ] Persist failures in the runner itself; use the error workflow as additional reporting.
- [ ] Implement authenticated lead list/detail, job polling, generation/retry actions, and controlled artifact downloads.
- [ ] Use published URLs under `/webhook/olivesoft/v1`; avoid holding HTTP open through AI or rendering.

**Acceptance:** ten tenders including invalid and duplicate inputs give expected records/errors; replays create no duplicates; a lead reaches `matched` without manual database edits; restart resumes work; unauthorized requests are rejected.

## 7. P0 — Prospect research

Owner: **Firas**.

Reuse the existing research validators, evidence checks, and transactional persistence where they satisfy the new contract. Its documented Wikipedia-only flow does not yet demonstrate the required agent with bounded search/fetch tools.

- [ ] Adapt research to the shared sub-workflow envelope and durable runner.
- [ ] Resolve the correct organization before researching similarly named organizations.
- [ ] Implement bounded agent search/fetch: at most three search calls, five page fetches, and five agent iterations per lead; define how retries count toward those limits.
- [ ] Set provider timeouts and treat web text as evidence, never as instructions.
- [ ] Permit public HTTPS targets only; reject private/local addresses and unsafe redirects, including at each redirect hop.
- [ ] Extract supported sector, projects, partners, and relevant needs with claim-level evidence.
- [ ] Validate final output outside the agent step and persist warnings and retrieval timestamps.
- [ ] Return minimal `partial: true` research when no useful evidence exists so matching can continue.
- [ ] Distinguish no useful results from provider failures in warnings/job diagnostics; never fabricate during outages.

**Acceptance:** five organization fixtures include an ambiguous name and a no-results case; every factual claim has evidence; unknown values remain unknown; live executions and concurrent/repeated persistence are checked.

## 8. P0 — Ingestion, retrieval, matching, and evaluation

Owner: **Nour**. Port the required behavior from the Python work into n8n; Python RAG must not remain a runtime dependency.

- [ ] Create/version 20 synthetic CVs, 15 project summaries, and at least three stack profiles with stable IDs and deliberate mismatches.
- [ ] Fetch documents from controlled storage, normalize metadata, retain source references, and reject empty/image-only content.
- [ ] Start splitting near 1,500 characters with 200-character overlap; record units and preserve page/section references.
- [ ] Use deterministic vector IDs derived from document ID/version/chunk. Re-ingestion must not increase counts, and replacement must remove obsolete chunks.
- [ ] Start with one collection and `asset_type` payload filters; use the same embedding model/dimensions for queries and indexing.
- [ ] Search per requirement, over-fetch, deduplicate by document, and keep the strongest evidence. Distinguish CVs from project references.
- [ ] Assign supported=1, partial=0.5, unsupported=0, unknown=null and validate judgments against human labels.
- [ ] Calculate `coverage = 100 × sum(support, with unknown=0) / requirement_count`; show the unknown count and flag mandatory unsupported/unknown requirements for review.
- [ ] Keep similarity separate from coverage; neither proves win probability or staff availability.
- [ ] Persist full requirement results and their evidence, not only aggregate scores.
- [ ] Build ten labelled positive FR/EN queries plus at least two no-match cases; report hit@5, P@5, and MRR with clear denominators.
- [ ] Achieve relevant documents in the top five for at least eight of the ten positive queries.
- [ ] Expand evaluation to 30 queries using exact terms and paraphrases, with corpus/model versions and reproducible reports.
- [ ] If exact terms are missed, evaluate PostgreSQL full-text search plus reciprocal-rank fusion on the same corpus/query set. Make hybrid a required gate if the official brief mandates it.

**Acceptance:** re-indexing creates no duplicate chunks, updates remove obsolete evidence, no-match queries produce no invented recommendations, and measured retrieval meets the initial gate.

## 9. P0 — Proposal generation and artifact delivery

Owner: **Firas**, with **Nour** reviewing grounding and **Dhiya** providing actions/downloads.

- [ ] Replace API rendering calls in the existing proposal workflow with n8n orchestration of the approved renderer and private storage.
- [ ] Assemble context only from validated tender, cited prospect, selected matches, coverage, and request parameters.
- [ ] Generate English structured content for seven to nine slides: cover, executive summary, requirements, approach, team, references, delivery assumptions, commercial assumptions, next steps.
- [ ] Do not require fabricated sector/team/reference data to pass generation preconditions. Report missing evidence and apply the agreed review policy.
- [ ] Label matched staff as candidates subject to availability; forbid invented rates, budgets, certifications, and outcomes.
- [ ] Enforce text limits, retain evidence, flag business gaps, and require review for weak coverage.
- [ ] Instantiate the approved template once per generation version; persist and reuse its identity on retries.
- [ ] Populate the copy, export both PPTX and PDF, and persist private stable provider IDs and MIME metadata.
- [ ] Make repeated generation requests reuse the same logical job and prevent duplicate artifact bundles.
- [ ] Mark `proposal_ready` only after both nonempty exports have been verified. Either export failing leaves the bundle incomplete.
- [ ] Open PPTX in PowerPoint and inspect PDF pages for clipping, long titles, bullets, multilingual source text, and unresolved placeholders.
- [ ] Check team/reference claims against evidence on five proposals and include a requirement matrix with source links.
- [ ] Serve downloads through authenticated workflows or controlled storage.

**Gate C:** submit tender → inspect research/matches → explicitly request proposal → poll progress → download editable PPTX/readable PDF. Replaying requests produces no duplicate bundle; all claims are grounded and no template tags remain.

## 10. P1 — Migration, operational checks, and release

- [ ] Rewrite README, `explication.txt`, and `docs/api.md` for the all-n8n architecture and authenticated asynchronous webhook contract.
- [ ] Add the agreed `plan-n8n.md` source plan to version control and distinguish it from this implementation-gap backlog.
- [ ] Update Compose/deployment for chosen service locations; retire API/ngrok dependencies after replacement n8n paths work.
- [ ] Archive/remove unused API and Python runtime code in a separate reviewed change, preserving team/local edits and reusable fixtures.
- [ ] Retain build/test tooling only where appropriate; it must not conceal a custom runtime backend.
- [ ] Replace the health-only smoke script with n8n readiness, database round trip, retrieval, job completion, and artifact verification.
- [ ] Add one scheduled tender source adapter with a durable checkpoint after manual intake passes.
- [ ] Document corpus/model versions, rebuild/evaluation steps, template versions, provider credentials, and workflow rebinding.
- [ ] Establish the release `main` branch and the documented personal branch → `dev` → release review flow.
- [ ] Rehearse clean import/deployment; every member must run the complete demo.
- [ ] Measure ten representative jobs: stage latency, model/search calls, cost, and failures. Soft targets: <2 minutes to `matched`, <3 additional minutes to exports.
- [ ] Agree a daily spend ceiling and cap concurrency, loops, and retries.
- [ ] Prepare architecture documentation, short demo, benchmark report, and delivery package. Label recorded fallback demonstrations clearly.
- [ ] Update the Notion workflow table, reviewed checkboxes, dated gate results, and append-only session log as verified work lands.

## 11. Suggested implementation order

| Order | Work | Required exit evidence |
|---|---|---|
| 1 | Provider/connectivity proof, contracts, migrations | Gate A evidence and migration checks |
| 2 | Durable intake/runner, research adaptation, ingestion/retrieval | Valid job/lead IDs, cited research, indexed versioned corpus |
| 3 | Matching and initial evaluation | A lead reaches `matched`; hit@5 ≥8/10; persisted matrix |
| 4 | Proposal generation, authenticated actions/downloads | Both real exports and complete Gate C journey |
| 5 | Failure/concurrency tests, docs, clean import, demo | Repeatable recovery and release evidence |

Start renderer export feasibility during order 1; do not wait for matching to discover rendering access problems. Keep dashboard polish, extra feeds, OCR, local models, and slide editing behind the core gates. Protect evidence, validation, and replay safety if the schedule slips.

## 12. Required verification before completion

| Check | Pass condition |
|---|---|
| Invalid intake / malformed extraction | Clear error, useful diagnostic, no falsely successful job/stage |
| Duplicate/concurrent requests | One lead/logical job per key; conflicting payload rejected |
| Research outage / no results | No fabricated claims; explicit warnings and appropriate partial/failure behavior |
| Re-ingestion/update | Stable counts; obsolete chunks removed |
| Retrieval/no-match | Published benchmark meets threshold; no forced endorsements |
| Proposal grounding | Approved evidence supports team/reference claims; assumptions labelled |
| Export failure | No `proposal_ready` until both files are valid |
| Restart/stale lease | Work resumes from durable checkpoint without duplicate output |
| Access control | Unauthenticated reads/actions/downloads rejected; credentials absent from exports |
| Clean import | Rebind documented credentials/IDs and pass fixtures on a clean environment |

**A task is complete only after implementation, export, contract validation, passing/failing fixtures, credential mapping, run instructions, and review.** Live gates additionally require recorded execution/artifact evidence. Do not mark this backlog complete based only on screenshots or static files.

## Review evidence

- [Reviewed dev tree](https://github.com/dhiyaeddineelgabsi/olivesoft/tree/53f40867b90c78219ffcf1976ec074337c050a1e)
- [Workflow inventory](https://github.com/dhiyaeddineelgabsi/olivesoft/tree/53f40867b90c78219ffcf1976ec074337c050a1e/n8n/workflows)
- [Deployment](https://github.com/dhiyaeddineelgabsi/olivesoft/blob/53f40867b90c78219ffcf1976ec074337c050a1e/docker-compose.yml)
- [Database schema](https://github.com/dhiyaeddineelgabsi/olivesoft/blob/53f40867b90c78219ffcf1976ec074337c050a1e/db/init.sql)
- [Proposal API implementation](https://github.com/dhiyaeddineelgabsi/olivesoft/blob/53f40867b90c78219ffcf1976ec074337c050a1e/api/app/generation/routes.py)
- [Research implementation notes](https://github.com/dhiyaeddineelgabsi/olivesoft/blob/53f40867b90c78219ffcf1976ec074337c050a1e/docs/prospect-workflow.md)
- [Proposal implementation notes](https://github.com/dhiyaeddineelgabsi/olivesoft/blob/53f40867b90c78219ffcf1976ec074337c050a1e/docs/proposal-generation.md)
- [Existing smoke script](https://github.com/dhiyaeddineelgabsi/olivesoft/blob/53f40867b90c78219ffcf1976ec074337c050a1e/scripts/smoke_test.sh)

## Session log

- 2026-09-25 — Created this backlog from the static repository review and supplied all-n8n project plan. No live gates were verified and no implementation tasks were marked complete.
