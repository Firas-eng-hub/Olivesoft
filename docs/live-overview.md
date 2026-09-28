# Live dashboard overview

The dashboard uses its Next.js server routes for n8n access. The browser never receives the n8n API key. Set these Vercel Production variables and redeploy:

| Variable | Value |
| --- | --- |
| `OLIVESOFT_UPLOAD_TEAM_PASSWORD` | Team password for unlocking the live dashboard and uploading files |
| `OLIVESOFT_N8N_UPLOAD_URL` | `https://dhiya-gvhtdshje3f0ehht.swedencentral-01.azurewebsites.net/webhook/olivesoft/v1/knowledge/upload` |
| `OLIVESOFT_N8N_UPLOAD_API_KEY` | Same value as the n8n Header Auth credential named `OLIVESOFT_N8N_UPLOAD_API_KEY` |

The n8n Header Auth credential must use header name `api-key`. The same credential currently protects the upload webhook, `wf5_api` read webhooks, and the `wf1_tender_detection` manual intake webhook. Keep it server-side. A later access-control pass should give different actions separate credentials and use individual team accounts.

## Connected contracts

| Dashboard route | n8n webhook | Purpose |
| --- | --- | --- |
| `GET /api/overview` | `GET /webhook/leads` | Latest 200 leads for overview and pipeline |
| `GET /api/overview?id=UUID` | `GET /webhook/lead?id=UUID` | Lead details, requirements, and matched document evidence |
| `POST /api/tenders` | `POST /webhook/tenders` | Manual tender intake |
| `GET /api/overview` | `GET /webhook/jobs` | Recent durable job records for Activity |
| `GET /api/knowledge/documents` | `GET /webhook/knowledge/documents` | Latest saved version of each uploaded knowledge document |

The dashboard requires the team password in `x-olivesoft-upload-password` for all three routes. Its server sends `api-key` to n8n. The browser uses the team password in memory for the current page session. Do not send the n8n key to browser code or prefix it with `NEXT_PUBLIC_`.

If the password is accepted but the overview returns a 502, check the server response message. A 401/403 from the n8n leads webhook means the Vercel `OLIVESOFT_N8N_UPLOAD_API_KEY` value does not match the `OLIVESOFT_N8N_UPLOAD_API_KEY` n8n Header Auth credential. A 404 means the published `wf5_api` leads webhook or configured n8n origin is wrong. The password and the Supabase Storage key are separate credentials; neither can replace this webhook API key. A jobs read failure no longer prevents leads from opening, but Activity remains empty until that read succeeds.

The overview cards, monthly chart bars, pipeline stages, and recent tender rows open filtered or detailed views. Counts and chart bars come from the returned leads. The n8n list endpoint is capped at 200, so these are recent-workspace figures until pagination and total counts are added. The local demo remains available when the three Vercel variables are absent.

## Verification and limits

- The dashboard build and type check pass.
- An n8n manual read of `wf5_api` returned `{ "items": [] }` successfully against the connected Postgres database on 2026-09-27. The database currently had no lead rows in that read.
- A missing UUID lead returned `{ "error": "lead not found" }` successfully. A real lead detail still needs checking after a lead exists.
- A manual live write on 2026-09-27 created test lead `8f4ee6a1-58ef-4abd-8733-c374ba3503f1` (execution 63). The UUID was returned and the lead was read back through the live detail route (execution 68). The first research attempt failed because the old workflow used columns absent from the deployed schema. A later attempt failed in its retired DuckDuckGo tool; the test lead remains `failed`.
- Research and matching now use UUID lead IDs and the deployed `prospects`/`matches` column names. Research runs from the authenticated intake handoff and currently records partial results from submitted tender context. The user approved external search, but no external search tool is connected or verified. Matching no longer starts proposal generation automatically. This revised chain has not had a successful end-to-end live run.
- The authenticated jobs read route returned `{ "items": [] }` in execution 71. Activity displays these persisted jobs, but intake currently does not create a job row, and generation/retry actions are still absent.
- On 2026-09-28, manual n8n executions 83 (`GET /leads`) and 84 (`GET /jobs`) succeeded against Postgres. An unauthenticated production `GET /webhook/leads` returned 403, confirming the webhook requires its Header Auth key. The live Vercel key value is not available in this checkout, so its match against the n8n credential remains unverified.
- The old proposal workflow contained placeholder artifact records and a render service URL. It was unpublished. No live proposal, retry, or artifact download should be treated as ready until real PPTX/PDF exports, job actions, and controlled file delivery are implemented and tested.
- Automatic approval review rejected a further live research execution because the draft search tool would send tender-derived text to DuckDuckGo and write results. That tool and the unauthenticated research test webhook were removed; no further research execution was attempted.

The committed credential-free workflow exports are [tender detection](../n8n/workflows/01_tender_detection.json), [prospect research](../n8n/workflows/02_prospect_research.json), [matching](../n8n/workflows/05_requirement_matching.json), and [read API](../n8n/workflows/08_read_api.json). Rebind credentials after import. Their live workflow IDs are `hiy8UJ2hy94RQCJo`, `yCkgzoyxGkFdWFto`, `s3hsG3EMPMUWzBbK`, and `HFwm7nYrcDS4adfZ` respectively.
