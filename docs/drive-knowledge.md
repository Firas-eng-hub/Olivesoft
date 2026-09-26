# Platform uploads to Drive and RAG

## Current flow

The **Knowledge base** lets a teammate choose CVs, expertise documents, and project references. The dashboard server checks a team upload password and file content, then forwards raw bytes to a protected n8n webhook. The n8n draft writes the original to the private OliveSoft Drive folder and returns its Drive file ID.

The upload workflow is [OliveSoft Knowledge Upload (draft)](https://dhiya-gvhtdshje3f0ehht.swedencentral-01.azurewebsites.net/workflow/dvXGNUUukgVpkZgL). It is **unpublished**, so uploads remain unavailable. Its destination is the folder supplied by the user, ID `1HFxdTVk56NF1HsL_g9a4V3JP7vAYTZQH`. The n8n Google Drive credential `olive soft api key` currently returns “Unable to sign without access token”; its access to that folder has not been verified.

A credential-free, importable draft is in [`12_knowledge_upload.json`](../n8n/workflows/12_knowledge_upload.json). Its folder locator uses the n8n environment variable `OLIVESOFT_KNOWLEDGE_FOLDER_ID`, which must be set to the approved folder ID after import. Rebind both credentials on import. The connected n8n draft already has the user-supplied folder ID set directly.

The draft auto-bound an existing `Header Auth account` credential. That credential is also used by Qdrant nodes in the existing ingestion workflow. **Rebind the upload webhook to a new dedicated `OliveSoft Upload Header Auth` credential before publishing it.** Give the new credential header name `api-key` and a strong unique value. The dashboard's `OLIVESOFT_N8N_UPLOAD_API_KEY` must match that value. The connected n8n MCP cannot create a credential or read its secret.

## Vercel setup

Set these server-only variables in the Vercel project rooted at `dashboard`:

| Variable | Value |
| --- | --- |
| `OLIVESOFT_UPLOAD_TEAM_PASSWORD` | Strong password shared with authorized uploaders out of band |
| `OLIVESOFT_N8N_UPLOAD_URL` | Published production URL ending in `/webhook/olivesoft/v1/knowledge/upload` |
| `OLIVESOFT_N8N_UPLOAD_API_KEY` | Value of the dedicated n8n Header Auth `api-key` credential |

The browser sends only the team password to the dashboard server. The n8n key remains server-side. This shared password is an interim gate; per-user sign-in and audit identity are needed before broad team use. Do not set the Vercel values or publish the draft until both n8n credentials and the destination folder are verified.

The UI and server accept nonempty PDF, DOCX, and TXT files up to 4 MB each. The server checks the extension, MIME type, and basic PDF/DOCX signatures. Selected files are held in browser memory until upload or navigation away from the section. A successful response means **stored in Drive, indexing pending**.

## RAG connection still required

The existing `knowledge_ingestion` workflow now has the supplied parent folder ID and its existing Qdrant cluster URL set in its Drive-scan configuration. It scans `cv`, `projets`, and `stacks` subfolders and extracts text files. It does not accept a newly uploaded Drive file ID, and it does not extract PDF or DOCX files. The upload draft writes to the supplied parent folder. Therefore uploads will not be indexed by the current ingestion path. The existing `wf3_rag_matching` draft also searches placeholder Qdrant collection URLs, while ingestion writes to `olivesoft_knowledge`.

To finish the connection in n8n:

1. Reconnect Google Drive OAuth and verify write access to the supplied folder. Create the dedicated upload Header Auth credential and rebind the webhook.
2. Add durable upload jobs in PostgreSQL with file hash, category, Drive ID, uploader, state, and retry-safe uniqueness. A Drive write failure must produce a failed job. A response should return a durable `job_id` once state is persisted.
3. Add a single-file input path to `knowledge_ingestion`: receive Drive ID and category, download that exact file, branch by PDF/DOCX/TXT, extract text, and reject empty or image-only content. Keep folder scanning for backfills.
4. Version source documents, use stable `asset_ref` and deterministic Qdrant chunk IDs, and retire obsolete chunks after replacement or deletion.
5. Point RAG search and matching at the actual `olivesoft_knowledge` collection, embedding model, and payload schema. Retrieve evidence per requirement, deduplicate by document, and link back to Drive. Do not infer candidate availability or unsupported certifications.
6. Add authenticated read endpoints for persisted upload/indexing state. The dashboard currently reports only the immediate Drive result, not durable index health.

The workflow inventory and acceptance gates are in [Plan.md](../Plan.md) and [Truth.md](../Truth.md). Do not put CV contents or real credentials in Git.

## Acceptance checks

- Upload two CVs, two project references, and one expertise file from the platform; verify each original in the approved Drive folder.
- Confirm invalid, oversized, unauthorized, failed, and duplicate uploads do not create unexpected Drive files or Qdrant points.
- Re-run unchanged ingestion and verify stable document and chunk counts. Verify an updated file retires old chunks.
- Retrieve expected evidence with French and English queries and a working Drive source link for an authorized user.
- Confirm an unauthorized user cannot upload, list, or download CV content.
