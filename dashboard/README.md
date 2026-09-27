# OliveSoft dashboard

Interactive Next.js demo for OliveSoft's internal bid team.

## Run

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Run `npm run build` for a production build. `npm run typecheck` checks TypeScript separately and is also part of the build command.

## Deploy on Vercel

Import this Git repository and set **Root Directory** to `dashboard`. Vercel will use [`vercel.json`](vercel.json) and the committed `package-lock.json`. With no integration variables, the dashboard runs the local demo. When the three values in [`.env.example`](.env.example) are set, it asks for the team password and loads leads from n8n through server-side routes. Redeploy after changing Vercel variables.

## Demo journey

1. Open **Tender pipeline** to search, filter, and inspect an opportunity.
2. On a matched tender, inspect the requirement matrix and evidence library, then select **Generate proposal**.
3. Watch simulated progress in **Activity**, then download the static sample PDF or PPTX in **Proposals**.
4. Use **Add new tender** to create a local demo record. **Reset demo** in Activity restores the starting data.
5. Open **Knowledge base** to select OliveSoft CVs, expertise files, or project references. Upload is available only when the protected server endpoint and n8n workflow are configured; selected files stay in browser memory until you leave the section.

The data is synthetic and saved in browser local storage. Proposal progress, fit scores, and trend visuals are illustrative. The downloadable files are static, clearly labelled demo fixtures; they are not generated from the selected tender. To regenerate them, run `python3 scripts/generate_demo_artifacts.py`.

## n8n integration boundary

`lib/types.ts` defines the frontend view models and `DashboardAdapter`. `lib/adapter.ts` provides the local demo implementation. Live overview data comes from `GET /api/overview`, which maps n8n `GET /webhook/leads` and `GET /webhook/lead?id=` into those models. Manual tender intake uses `POST /api/tenders` → n8n `POST /webhook/tenders`. Both dashboard routes require the team password and forward the n8n Header Auth key only from the server. The n8n webhooks share the `OLIVESOFT_N8N_UPLOAD_API_KEY` credential for now. The main overview cards, monthly chart, pipeline stages, and lead rows navigate to real tender records in live mode. New manual tenders remain detected while the legacy research workflow is adapted to UUID lead IDs. Live proposal generation, retries, jobs, and artifact delivery remain unconnected.

All workflow decisions, scoring, retrieval, and proposal generation must remain in n8n. The dashboard should display persisted results and submit explicit actions. A `proposal_ready` lead must represent two verified artifacts in the live integration, as specified in [../Plan.md](../Plan.md).

The Knowledge base has a server-side upload proxy for PDF, DOCX, and TXT files up to 4 MB. It checks the same team password and forwards each file to the protected n8n upload webhook. Set the values in [`.env.example`](.env.example) as Vercel environment variables; keep real secrets out of Git. The n8n upload workflow is published, but a successful end-to-end Supabase Storage and Qdrant run is still required. See [Supabase knowledge integration](../docs/supabase-knowledge.md) for setup and remaining RAG work.
