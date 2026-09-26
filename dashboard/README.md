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

Import this Git repository and set **Root Directory** to `dashboard`. Vercel will use [`vercel.json`](vercel.json) and the committed `package-lock.json`. No environment variables are needed for the current demo. The n8n workflows are not connected yet, so the deployed dashboard will continue to show local synthetic data.

## Demo journey

1. Open **Tender pipeline** to search, filter, and inspect an opportunity.
2. On a matched tender, inspect the requirement matrix and evidence library, then select **Generate proposal**.
3. Watch simulated progress in **Activity**, then download the static sample PDF or PPTX in **Proposals**.
4. Use **Add new tender** to create a local demo record. **Reset demo** in Activity restores the starting data.
5. Open **Knowledge base** to select OliveSoft CVs, expertise files, or project references for the planned platform-to-Drive upload. The selected files stay in browser memory until you leave the section and are not uploaded while the n8n integration is pending.

The data is synthetic and saved in browser local storage. Proposal progress, fit scores, and trend visuals are illustrative. The downloadable files are static, clearly labelled demo fixtures; they are not generated from the selected tender. To regenerate them, run `python3 scripts/generate_demo_artifacts.py`.

## n8n integration boundary

`lib/types.ts` defines the frontend view models and `DashboardAdapter`. `lib/adapter.ts` provides the local demo implementation. Once the authenticated n8n read and action webhooks are deployed, add a live adapter that maps their responses into these models. Keep n8n credentials and action authentication on the server side; do not expose them in client code. The published webhook base is `/webhook/olivesoft/v1`, but exact route contracts are not yet implemented in this checkout.

All workflow decisions, scoring, retrieval, and proposal generation must remain in n8n. The dashboard should display persisted results and submit explicit actions. A `proposal_ready` lead must represent two verified artifacts in the live integration, as specified in [../Plan.md](../Plan.md).

The Knowledge base is a UI preview for platform uploads into the private Drive corpus. See [Drive knowledge integration](../docs/drive-knowledge.md) for the upload and n8n ingestion contract. No Drive credentials or private document contents belong in this repository or the browser bundle.
