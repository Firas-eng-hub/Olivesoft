# OliveSoft

OliveSoft is an RFP intelligence project. The target workflow is tender detection → prospect research → requirement matching → evidence-backed proposal generation, with business logic in n8n.

## Dashboard demo

The interactive frontend is in [dashboard/](dashboard/README.md). It currently runs with clearly marked synthetic data and static sample downloads; it is not connected to n8n yet.

```bash
cd dashboard
npm install
npm run dev
```

Open `http://localhost:3000`. See [Plan.md](Plan.md) and [Truth.md](Truth.md) for the workflow architecture and acceptance gates.
