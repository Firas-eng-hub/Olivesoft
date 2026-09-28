# Platform uploads to Supabase Storage

The **Knowledge base** accepts PDF, DOCX, and TXT files up to 4 MB. The dashboard server checks a team upload password, validates the file, and sends its bytes to the protected n8n webhook. The [upload workflow draft](https://dhiya-gvhtdshje3f0ehht.swedencentral-01.azurewebsites.net/workflow/dvXGNUUukgVpkZgL) writes the original to a **private Supabase Storage bucket** under `cv/`, `expertise/`, or `project/`. A successful upload returns the bucket and object path and queues `knowledge_ingestion` asynchronously. It does **not** mean the file has been indexed for RAG.

The upload workflow is published with the `OLIVESOFT_N8N_UPLOAD_API_KEY` Header Auth credential used by the dashboard. Its live Storage and indexing path still needs an end-to-end test. The checked-in workflow is [12_knowledge_upload.json](../n8n/workflows/12_knowledge_upload.json).

**Current status (2026-09-28):** The live webhook uses the dashboard's Header Auth credential, receives raw binary, and accepts CV uploads. The Storage upload and ingestion download nodes use the `OliveSoft Supabase Storage` Header Auth credential (`apikey` header); their URL and bucket are public configuration in the workflow. This removes the blocked `$env` dependency from the Storage path. Both workflows were published after the change. No successful CV upload has been observed yet, so the dashboard 502 is not confirmed resolved. The ingestion Qdrant URL still comes from `$env` and must be configured separately before indexing can succeed. The dashboard proxy distinguishes upstream authentication and validation failures in its error message. [n8n documents the environment access setting](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/security/); [Supabase requires new secret keys on the `apikey` header](https://supabase.com/docs/guides/getting-started/api-keys).

## 1. Supabase setup

1. In the Supabase project, open **Storage → New bucket**. Create `olivesoft-knowledge` (or another name) as a **private** bucket. Set its file size limit to at least 4 MB and allow `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, and `text/plain` if you enable MIME restrictions.
2. In **Project Settings → API Keys**, create or copy a server-side **secret key** (`sb_secret_...`). It has broad project access. Set it as the value of an n8n Header Auth credential named `OliveSoft Supabase Storage` with header name `apikey`. Never put it in a `NEXT_PUBLIC_` variable, browser code, workflow export, or Git. Rotate any key shared outside the credential store.
3. The live workflow uses this public project configuration:

   | Name | Value |
   | --- | --- |
   | Project URL | `https://okhntgauzbumgidpuyvx.supabase.co` |
   | Private bucket | `olivesoft-knowledge` |

   Both Storage HTTP Request nodes send the credential in the Storage API's `apikey` header. Rebind the named credential after importing an export.

The supplied project reference is `okhntgauzbumgidpuyvx`, so its Storage API base URL is `https://okhntgauzbumgidpuyvx.supabase.co`. The local [n8n environment template](../n8n/.env.example) and ignored `n8n/.env` now contain that URL and the supplied pooler settings. **No database password or Supabase secret key was provided**, so both secret fields remain empty. The project reference, database password, and Supabase secret key are three different values.

The supplied legacy Supabase **anon** key is stored only in the ignored local `n8n/.env` as `OLIVESOFT_SUPABASE_ANON_KEY`. The current workflows do not read it. It has the low-privilege `anon` role and cannot replace `OLIVESOFT_SUPABASE_SECRET_KEY` for the private server-side Storage flow without adding an explicit Storage access policy. Supabase recommends new publishable and secret keys for new integrations; see [API key types](https://supabase.com/docs/guides/getting-started/api-keys).

The hosted n8n instance runs on Azure App Service. A repository `.env` file is only a local reference; uploading this repository will not set the hosted n8n environment. The Storage nodes no longer need `OLIVESOFT_SUPABASE_*` environment values. Qdrant indexing still needs a reachable `OLIVESOFT_QDRANT_URL`, and this host currently denies `$env` expressions, so its configuration needs a separate repair. See [Azure App Service app settings](https://learn.microsoft.com/en-us/azure/app-service/configure-common?tabs=portalfli).

### Supabase Postgres pooler credential in n8n

The Postgres nodes use an **n8n Postgres credential**, not the Storage secret key and not the `OLIVESOFT_DB_*` values in `.env`. In n8n, open **Credentials**, create or edit a Postgres credential, and enter:

| Field | Value |
| --- | --- |
| Host | `aws-1-eu-west-1.pooler.supabase.com` |
| Port | `5432` (shared pooler, session mode) |
| Database | `postgres` |
| User | `postgres.okhntgauzbumgidpuyvx` |
| Password | Your **database password** from the Supabase project, not the `sb_secret_` API key |
| SSL/TLS | Enable it for the connection |

Use **Supabase Dashboard → Connect → Session pooler** to confirm or reset the database password. If you paste a full connection URL, percent-encode reserved characters in the password; when filling n8n's separate Password field, enter the actual password. Supabase documents port `5432` as shared session mode and `6543` as transaction mode; the latter does not support prepared statements. See [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres).

Save and test the credential, then bind it to the Postgres nodes in `wf1_tender_detection`, `wf2_prospect_research`, `wf3_rag_matching`, `wf4_proposal_generation`, and `wf5_api`. The MCP connection can see credential names but cannot read or replace their secret values, so this binding and connection test must be done in n8n. If you update the existing `Postgres account` credential, confirm it points to this project before running writes.

## 2. Protect and publish the n8n webhook

Open the [upload workflow](https://dhiya-gvhtdshje3f0ehht.swedencentral-01.azurewebsites.net/workflow/dvXGNUUukgVpkZgL). Its webhook is bound to the dedicated n8n Header Auth credential `OLIVESOFT_N8N_UPLOAD_API_KEY`. Confirm its header name is `api-key` and that its value matches Vercel's server-side variable of the same name. Do not reuse the Qdrant header credential.

After the Supabase secret is configured in an n8n credential, test one CV upload from the dashboard and verify the object appears in the private bucket. Then test a PDF and DOCX, bad category, oversized file, wrong key, and a failed Supabase request. The production URL is:

`https://dhiya-gvhtdshje3f0ehht.swedencentral-01.azurewebsites.net/webhook/olivesoft/v1/knowledge/upload`

Supabase Storage responds with an object key. The n8n response contract is `{ "status": "uploaded", "bucket": "...", "storage_path": "cv/EXECUTION_ID/file.pdf", "indexing": "pending" }`. The dashboard displays this private object path, not a public URL.

## 3. Vercel environment variables

Add these three **server-side** variables in **Vercel → Project → Settings → Environment Variables**, for every environment that should accept uploads, then redeploy:

| Name | Value |
| --- | --- |
| `OLIVESOFT_UPLOAD_TEAM_PASSWORD` | A separate strong password teammates enter in the upload form |
| `OLIVESOFT_N8N_UPLOAD_URL` | The published production webhook URL above |
| `OLIVESOFT_N8N_UPLOAD_API_KEY` | The value of the dedicated n8n `api-key` credential |

Do **not** add the Supabase secret key to Vercel for this flow. Vercel never calls Supabase directly. Keep the team password and webhook API key different. `.env.example` contains names only.

`OLIVESOFT_DOCS_TOKEN` currently has **no reader** in the dashboard or n8n workflow exports. Adding it in Vercel does not protect the upload form or grant Supabase access. The upload form uses `OLIVESOFT_UPLOAD_TEAM_PASSWORD`; the server-to-n8n request uses `OLIVESOFT_N8N_UPLOAD_API_KEY`. Keep those values separate from the Supabase anon and secret keys.

## 4. Ingestion and matching workflows

The published workflows are [knowledge_ingestion](https://dhiya-gvhtdshje3f0ehht.swedencentral-01.azurewebsites.net/workflow/1nspjntygwd5WWej) and [wf3_rag_matching](https://dhiya-gvhtdshje3f0ehht.swedencentral-01.azurewebsites.net/workflow/s3hsG3EMPMUWzBbK). Their credential-free exports are [03_knowledge_ingestion.json](../n8n/workflows/03_knowledge_ingestion.json) and [05_requirement_matching.json](../n8n/workflows/05_requirement_matching.json).

`knowledge_ingestion` now accepts `{ "bucket": "...", "storage_path": "cv/EXECUTION_ID/file.pdf" }` from the upload workflow, validates the private bucket/path, downloads the object from Supabase Storage, extracts PDF/TXT text or decompresses DOCX `word/document.xml`, chunks it, embeds with `gemini-embedding-2` at 768 dimensions, and upserts into Qdrant `olivesoft_knowledge`. Empty or image-only documents fail extraction. Its old Drive scan nodes were removed; the manual fixture branch remains for isolated tests. The workflow currently has a disconnected `Config` branch for Qdrant collection setup that must be run separately if the collection does not already exist.

`wf3_rag_matching` now uses the same Gemini model and 768 dimensions. It queries the one Qdrant collection with filters for `cv`, `project`, and `expertise`, only accepts payloads with `source: supabase_storage`, deduplicates by document, and carries `source_bucket`/`source_path` in its match payload. Disconnected Drive/Dropbox nodes were removed. It continues using the project's Supabase Postgres tables for leads and matches.

Configure a reachable Qdrant base URL (including port if needed) in the n8n workflow before relying on indexing; `$env.OLIVESOFT_QDRANT_URL` currently fails on this host. Check the n8n Header Auth credentials on both workflows: Gemini requests need `x-goog-api-key`, Qdrant requests need `api-key`, and Supabase Storage needs the `OliveSoft Supabase Storage` `apikey` credential. Vercel still needs only the three variables in section 3.

## Other live workflows

| Workflow | Supabase change |
| --- | --- |
| `wf1_tender_detection` | Already persists leads through the project's Supabase Postgres credential; no Drive node. |
| `wf2_prospect_research` | Already reads and writes Supabase Postgres; calls `wf3_rag_matching`, so it inherits the new source evidence. |
| `wf4_proposal_generation` | Already reads matches and writes artifact metadata to Supabase Postgres; its placeholder render service and artifact file storage still need implementation before it can produce a private Supabase file. |
| `wf5_api` | Already reads leads, matches, and artifact metadata from Supabase Postgres; authenticated file delivery for private artifacts remains open. |

No other live workflow contains a Drive node. The remaining proposal and artifact work is separate from CV/expertise ingestion and is not validated by this change.

## 5. Verification before publication

These graph changes are published. Node configuration validation passed and the live Storage nodes are bound to the Supabase credential, but no binary CV upload has been observed. Before relying on the integration:

1. Test TXT, PDF, and DOCX uploads from the dashboard and confirm each original is in the private bucket. Check that `knowledge_ingestion` receives the same bucket/path and writes nonempty chunks to `olivesoft_knowledge`.
2. Test a malformed path, wrong bucket, empty PDF, bad DOCX, and a Supabase download failure. Confirm failures do not create Qdrant points.
3. Run matching against a researched lead with known evidence. Confirm the result cites the expected Supabase bucket/path and that no `REPLACE-ME` Qdrant URL is used.
4. Check credentials on the existing Postgres, Gemini, and Qdrant nodes. Verify `wf4_proposal_generation` and `wf5_api` separately before production use; they use Supabase Postgres but proposal rendering and artifact delivery still have other open work.
5. Add a durable PostgreSQL upload/indexing job and authenticated status endpoint before treating the UI's **indexing pending** receipt as a complete indexing state. An authenticated signed URL is still needed for human review of private sources.

Supabase private buckets require authorized downloads or signed URLs; a public object URL should not be constructed for CVs. See [Supabase Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads), and [API keys](https://supabase.com/docs/guides/getting-started/api-keys). Qdrant's [query API](https://qdrant.tech/documentation/search/) supports payload filters in a single collection. Gemini's [embedding API](https://ai.google.dev/api/embeddings) supports a 768-dimensional retrieval configuration.
