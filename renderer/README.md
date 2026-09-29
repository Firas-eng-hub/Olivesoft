# OliveSoft proposal renderer

This is a separate Vercel project with root directory `renderer/`. It formats the validated proposal payload from n8n as a native, editable PPTX using PptxGenJS and a readable PDF using pdf-lib. It makes no research, matching, pricing, staffing, or tender selection decisions. Google Drive, Google Slides, and Gotenberg are not used because the web apps deploy on Vercel.

## Deploy

1. Create a Vercel project from this repository with root directory `renderer` and Node.js 22. Set server-only environment variable `OLIVESOFT_RENDERER_TOKEN` to a fresh, long random secret. Do not use a `NEXT_PUBLIC_` prefix.
2. Deploy and record its production origin. `GET /api/render` returns a health response. `POST /api/render` requires `Authorization: Bearer <token>`.
3. Create an n8n Header Auth credential named `OliveSoft Proposal Renderer` with header `Authorization` and value `Bearer <same token>`. Replace `https://REPLACE_WITH_RENDERER_VERCEL_HOST/api/render` in `06_proposal_generation.json` before import, then bind that credential.
4. Keep the dashboard's `OLIVESOFT_N8N_PROPOSALS` unset until an n8n proposal job uploads and opens both files from private Supabase Storage. Set it to `1` in the dashboard Vercel project only after that live test.

The response contains two base64 files and SHA-256 digests. The renderer caps their combined bytes so the response stays below [Vercel's 4.5 MB function payload limit](https://vercel.com/docs/functions/limitations). n8n converts them to managed binary data, uploads them to the private `olivesoft-proposals` bucket, and calls `finalize_proposal_bundle`. The renderer rejects unresolved tags, invalid requirements, missing evidence for a claimed judgment, and public claims that do not appear verbatim in their cited excerpt. n8n must still select and validate the evidence before calling it.

Run `npm ci && npm test` locally. The tests open the generated PDF and inspect the PPTX archive, and reject unsupported claims and template tags.
