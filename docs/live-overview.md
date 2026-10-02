# Live dashboard overview

The Vercel project uses `dashboard` as its root directory. Its Next.js server routes call n8n, which connects to Supabase Postgres; the browser never receives an n8n or Supabase key. Set these Vercel Production variables and redeploy:

| Variable | Value |
| --- | --- |
| `OLIVESOFT_UPLOAD_TEAM_PASSWORD` | Team password for unlocking the live dashboard and uploading files |
| `OLIVESOFT_N8N_UPLOAD_URL` | `https://dhiya-gvhtdshje3f0ehht.swedencentral-01.azurewebsites.net/webhook/olivesoft/v1/knowledge/upload` |
| `OLIVESOFT_N8N_UPLOAD_API_KEY` | Same value as the n8n Header Auth credential named `OLIVESOFT_N8N_UPLOAD_API_KEY` |
| `OLIVESOFT_N8N_ASYNC_INTAKE` | Set to `1` after the durable intake and read workflows are verified |

The n8n Header Auth credential must use header name `api-key`. The same credential currently protects the upload webhook, `wf5_api` read webhooks, and the `wf1_tender_detection` manual intake webhook. Keep it server-side. A later access-control pass should give different actions separate credentials and use individual team accounts.

## Connected contracts

| Dashboard route | n8n webhook | Purpose |
| --- | --- | --- |
| `GET /api/overview` | `GET /webhook/leads` | Latest 200 leads for overview and pipeline |
| `GET /api/overview?id=UUID` | `GET /webhook/lead?id=UUID` | Lead details, requirements, and matched document evidence |
| `POST /api/tenders` | `POST /webhook/tenders` | Manual tender intake |
| `GET /api/discovery?source=ted` | `GET /webhook/tenders/discover/ted` | Recent official EU IT competition notices |
| `GET /api/discovery?source=tavily` | `GET /webhook/tenders/discover/tavily` | Wider web tender suggestions |
| `GET /api/overview` | `GET /webhook/jobs` | Recent durable job records for Activity |
| `GET /api/knowledge/documents` | `GET /webhook/knowledge/documents` | Latest saved version of each uploaded knowledge document |

The dashboard requires the team password in `x-olivesoft-upload-password` for these live routes. Its server sends `api-key` to n8n. The browser uses the team password in memory for the current page session. Do not send the n8n key to browser code or prefix it with `NEXT_PUBLIC_`.

The **Find tenders** view scans TED's public Search API or Tavily Search through the published `tender_discovery` n8n workflow. The server proxy checks the same team password. Results are suggestions, not saved leads. A teammate opens the original notice, corrects title, buyer, summary, and deadline in the review form, and then submits through the existing tender intake route. The intake stores the source label and original URL in `raw_payload`. TED searches recent competition notices in IT service CPV 72000000. Tavily uses its n8n Header Auth credential; if the Tavily request fails, the workflow searches SerpApi through its n8n Query Auth credential and labels those suggestions `SerpApi`.

On 2026-10-01, the automatic **Opportunities** rollout went live: migration 007 is applied to Supabase, the authenticated opportunity API (`F9ynrtrOPJ98NskB`) serves the candidate list, review, and accept webhooks, and the scheduled scan (`i4S6GuhlVYPwC3yk`) runs daily at 06:00 Africa/Tunis and auto-queues complete candidates into durable intake (first scheduled run 2026-10-02 00:00 UTC, execution 1887). `OLIVESOFT_N8N_ASYNC_INTAKE=1` is enabled on Vercel and in local dev, and the dashboard review → Create opportunity flow was verified end-to-end on the deployed site (job `97d14e43`, lead `0c63d29e`, matched with a 17% fit). Incomplete candidates still wait for human review, and acceptance saves comments but does not start proposal generation. See [automatic opportunities rollout](opportunities.md).

The supplied Tavily and SerpApi keys were tested directly and stored in the ignored local `n8n/.env`. The published workflow uses `OliveSoft Tavily` Header Auth with header `Authorization` and value `Bearer <Tavily key>`, and `OliveSoft SerpApi query` Query Auth with query parameter `api_key` and value `<SerpApi key>`. SerpApi's Search API requires its key as a query parameter. Rebind both credentials after importing the export. Never put either value in a workflow export.

If the password is accepted but the overview returns a 502, check the server response message. A 401/403 from the n8n leads webhook means the Vercel `OLIVESOFT_N8N_UPLOAD_API_KEY` value does not match the `OLIVESOFT_N8N_UPLOAD_API_KEY` n8n Header Auth credential. A 404 means the published `wf5_api` leads webhook or configured n8n origin is wrong. The password and the Supabase Storage key are separate credentials; neither can replace this webhook API key. A jobs read failure no longer prevents leads from opening, but Activity remains empty until that read succeeds.

The overview cards, monthly chart bars, pipeline stages, and recent tender rows open filtered or detailed views. Counts and chart bars come from the returned leads. The n8n list endpoint is capped at 200, so these are recent-workspace figures until pagination and total counts are added. The local demo remains available when the three Vercel variables are absent.

## Verification and limits

On 2026-09-29, manual n8n execution 193 confirmed the published intake rejects tenders without an explicit requirements list (422). Executions 194, 195, and 196 created synthetic lead `d29d2eb0-f781-4db4-aab8-45d50ebd035a` and advanced it to `matched`. Research remained partial with zero public citations, and matching stored document scores without requirement judgments. This is not proposal evidence. On 2026-09-29, draft RAG workflow execution 249 returned the expected document at rank one for all ten labelled FR/EN queries (hit@5 10/10); this is retrieval evidence only. See [RAG evaluation](rag-evaluation.md) and [draft pipeline rollout](pipeline-rollout.md) for the migration, new exports, deployment order, and remaining release gates.

- The dashboard build and type check pass.
- An n8n manual read of `wf5_api` returned `{ "items": [] }` successfully against the connected Postgres database on 2026-09-27. The database currently had no lead rows in that read.
- A missing UUID lead returned `{ "error": "lead not found" }` successfully. A real lead detail still needs checking after a lead exists.
- A manual live write on 2026-09-27 created test lead `8f4ee6a1-58ef-4abd-8733-c374ba3503f1` (execution 63). The UUID was returned and the lead was read back through the live detail route (execution 68). The first research attempt failed because the old workflow used columns absent from the deployed schema. A later attempt failed in its retired DuckDuckGo tool; the test lead remains `failed`.
- Research and matching now use UUID lead IDs and the deployed `prospects`/`matches` column names. Research runs from the authenticated intake handoff and currently records partial results from submitted tender context. The user approved external search, but no external search tool is connected or verified. Matching no longer starts proposal generation automatically. This revised chain has not had a successful end-to-end live run.
- The authenticated jobs read route returned `{ "items": [] }` in execution 71. Activity displays these persisted jobs, but intake currently does not create a job row, and generation/retry actions are still absent.
- On 2026-09-28, manual n8n executions 83 (`GET /leads`) and 84 (`GET /jobs`) succeeded against Postgres. An unauthenticated production `GET /webhook/leads` returned 403, confirming the webhook requires its Header Auth key. The live Vercel key value is not available in this checkout, so its match against the n8n credential remains unverified.
- The old proposal workflow contained placeholder artifact records and a render service URL. It was unpublished. The user has ruled out Google Drive and Slides. A Vercel renderer and job actions are now drafted, but no live proposal, retry, or artifact download should be treated as ready until the exports are uploaded to private Storage and opened through authenticated delivery.
- Automatic approval review rejected a further live research execution because the draft search tool would send tender-derived text to DuckDuckGo and write results. That tool and the unauthenticated research test webhook were removed; no further research execution was attempted.
- On 2026-09-28, manual `tender_discovery` execution 116 returned 15 TED notice suggestions. Execution 118 returned 10 suggestions using the Tavily credential. In draft execution 119, a forced Tavily 404 reached SerpApi and returned 10 mapped suggestions; execution 120 returned 10 Tavily suggestions after restoring its URL. The restored workflow and fallback were published as version `35804eef-4006-4ad6-a89b-01b5b1387593`. These are discovery checks, not proof of an imported lead or researched prospect. The hosted Vercel-to-n8n request still needs a browser smoke check after deployment.

The committed credential-free workflow exports are [tender detection](../n8n/workflows/01_tender_detection.json), [prospect research](../n8n/workflows/02_prospect_research.json), [matching](../n8n/workflows/05_requirement_matching.json), [read API](../n8n/workflows/08_read_api.json), and [tender discovery](../n8n/workflows/13_tender_discovery.json). Rebind credentials after import. Their live workflow IDs are `hiy8UJ2hy94RQCJo`, `yCkgzoyxGkFdWFto`, `s3hsG3EMPMUWzBbK`, `HFwm7nYrcDS4adfZ`, and `I3bURz1ImcNBPhqr` respectively.
