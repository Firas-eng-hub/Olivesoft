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

The dashboard requires the team password in `x-olivesoft-upload-password` for all three routes. Its server sends `api-key` to n8n. The browser uses the team password in memory for the current page session. Do not send the n8n key to browser code or prefix it with `NEXT_PUBLIC_`.

The overview cards, monthly chart bars, pipeline stages, and recent tender rows open filtered or detailed views. Counts and chart bars come from the returned leads. The n8n list endpoint is capped at 200, so these are recent-workspace figures until pagination and total counts are added. The local demo remains available when the three Vercel variables are absent.

## Verification and limits

- The dashboard build and type check pass.
- An n8n manual read of `wf5_api` returned `{ "items": [] }` successfully against the connected Postgres database on 2026-09-27. The database currently had no lead rows in that read.
- A missing UUID lead returned `{ "error": "lead not found" }` successfully. A real lead detail still needs checking after a lead exists.
- Manual tender creation has not been tested against live n8n. Its extraction prompt and UUID failure update were corrected. The call from tender detection to prospect research is disabled because the downstream research and matching workflows still contain legacy integer lead casts. A new tender will remain in the detected stage until that UUID/schema repair is complete.
- Proposal generation, retries, job activity, and artifact downloads still use demo behavior or pending notices in the dashboard. They need authenticated n8n action and job contracts before use with live records.

The committed credential-free workflow exports are [tender detection](../n8n/workflows/01_tender_detection.json) and [read API](../n8n/workflows/08_read_api.json). Rebind credentials after import. The live workflow IDs are `hiy8UJ2hy94RQCJo` and `HFwm7nYrcDS4adfZ` respectively.
