# OliveSoft

OliveSoft is an RFP intelligence project. The target workflow is tender detection → prospect research → requirement matching → evidence-backed proposal generation, with business logic in n8n.

## Dashboard demo

The interactive frontend is in [dashboard/](dashboard/README.md). Its live mode connects authenticated tender, overview, and Knowledge base routes to n8n; demo mode still uses synthetic data and sample downloads. Proposal generation and live artifact downloads remain unfinished. See [Truth.md](Truth.md#mvp-implementation-remaining-2026-09-28) for the MVP implementation checklist.

```bash
cd dashboard
npm install
npm run dev
```

Open `http://localhost:3000`. See [Plan.md](Plan.md) and [Truth.md](Truth.md) for the workflow architecture and acceptance gates.
