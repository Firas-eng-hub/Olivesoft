# Platform uploads to Supabase Storage

The **Knowledge base** accepts PDF, DOCX, and TXT files up to 4 MB. The dashboard server checks a team upload password, validates the file, and sends its bytes to the protected n8n webhook. The [upload workflow draft](https://dhiya-gvhtdshje3f0ehht.swedencentral-01.azurewebsites.net/workflow/dvXGNUUukgVpkZgL) writes the original to a **private Supabase Storage bucket** under `cv/`, `expertise/`, or `project/`. A successful upload returns the bucket and object path. It does **not** mean the file has been indexed for RAG.

The workflow is unpublished. Configure the values below, rebind the webhook credential, then test before publishing. The checked-in workflow is [12_knowledge_upload.json](../n8n/workflows/12_knowledge_upload.json).

## 1. Supabase setup

1. In the Supabase project, open **Storage → New bucket**. Create `olivesoft-knowledge` (or another name) as a **private** bucket. Set its file size limit to at least 4 MB and allow `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, and `text/plain` if you enable MIME restrictions.
2. In **Project Settings → API Keys**, create or copy a server-side **secret key** (`sb_secret_...`). It has broad project access. Keep it only in n8n's server environment or a dedicated n8n credential; never put it in a `NEXT_PUBLIC_` variable, browser code, or Git.
3. Configure these environment values on the **n8n server**, then restart n8n so expressions can read them:

   | Name | Value |
   | --- | --- |
   | `OLIVESOFT_SUPABASE_URL` | Project URL, such as `https://PROJECT_REF.supabase.co` |
   | `OLIVESOFT_SUPABASE_BUCKET` | Exact private bucket name, such as `olivesoft-knowledge` |
   | `OLIVESOFT_SUPABASE_SECRET_KEY` | Supabase server-side secret key |

   The workflow sends that key in the Storage API's `apikey` header. If your n8n deployment restricts `$env` expressions, put the secret in an n8n credential and update the HTTP Request node to use it before publishing. Never paste the key into a node parameter or workflow export.

## 2. Protect and publish the n8n webhook

Open the [upload workflow draft](https://dhiya-gvhtdshje3f0ehht.swedencentral-01.azurewebsites.net/workflow/dvXGNUUukgVpkZgL). Its webhook currently points at an unrelated existing `Header Auth account` credential. Create a **dedicated** n8n Header Auth credential named `OliveSoft Upload Header Auth` with header name `api-key` and a long random value. Rebind the webhook to it. Do not reuse the Qdrant header credential.

Test one TXT upload through n8n's test webhook and verify the object appears in the private bucket. Then test a PDF and DOCX, bad category, oversized file, wrong key, and a failed Supabase request. Publish only after those checks pass. The production URL is:

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

## 4. RAG integration still required

The existing `knowledge_ingestion` workflow scans Google Drive and currently extracts text files only. It has **not** been converted to Supabase Storage and does not process these uploads. The existing `wf3_rag_matching` draft searches placeholder Qdrant collection URLs while ingestion writes to `olivesoft_knowledge`. Uploads will be stored privately but **will not appear in matching** until these steps are implemented and verified:

1. Persist upload jobs with bucket, object path, category, content hash, state, and retry-safe uniqueness in PostgreSQL. Return a durable job ID after that state is saved.
2. Add a single-object input to `knowledge_ingestion` that downloads the object from Supabase Storage using server-side credentials. Extract PDF, DOCX, and TXT text; reject empty or image-only documents; record failures and retries.
3. Chunk and embed the extracted text using the same model and Qdrant collection that matching queries. Store bucket and object path in each source citation. Provide an authenticated way to generate a short-lived signed URL for human review.
4. Expose authenticated indexing status in the dashboard. Keep the upload receipt labeled **indexing pending** until the ingestion state confirms otherwise.
5. Run a live retrieval check with French and English queries and verify cited content against the original private document.

Supabase private buckets require authorized downloads or signed URLs; a public object URL should not be constructed for CVs. See [Supabase Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads), and [API keys](https://supabase.com/docs/guides/getting-started/api-keys).
