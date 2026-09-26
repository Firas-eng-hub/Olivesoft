# Platform uploads to Drive and RAG

## Intended user flow

An authorized OliveSoft teammate opens **Knowledge base**, chooses CVs, expertise documents, or project references, and uploads them in the platform. The platform sends each original file to a private OliveSoft Google Drive folder through a protected server-to-n8n action. n8n records the Drive file ID and starts the knowledge-ingestion workflow. The dashboard then shows durable upload and indexing status, plus a link to the Drive source for authorized users.

The current dashboard only lets users select files and preview a local queue. Its **Upload to Drive** action is disabled because authentication, the upload endpoint, the Drive destination, and the n8n workflow are not yet configured. Selected files remain in browser memory and disappear when the user leaves the section. No upload or indexing is implied by this preview.

## Source categories

| Type | Content | Matching use |
| --- | --- | --- |
| `cv` | Consultant CVs and validated skills | Candidate capabilities and seniority; availability needs separate confirmation |
| `expertise` | Service descriptions, stack profiles, certifications | Company capabilities and technical fit |
| `project` | Delivered project references and outcomes | Evidence of comparable delivery |

The UI accepts nonempty PDF, DOCX, or TXT files up to 10 MB each for the preview. The production endpoint must enforce its own file size, MIME, and content checks. PDFs with no extractable text need an explicit extraction error or a tested OCR path.

## Required integration

1. Add team authentication and authorization to the dashboard. The public demo must not accept private CV uploads.
2. Configure one private Drive destination folder and an n8n Google Drive credential with write access. Keep the folder ID and credentials in server environment or n8n configuration, outside Git and client code.
3. Add an authenticated upload endpoint on the dashboard server. It forwards file bytes and the chosen category to a protected n8n webhook. It must stream or bound the body, reject unsupported files, and return a durable `job_id` only after n8n persists the upload job.
4. In n8n, store the original in Drive, record `drive_file_id`, original filename, MIME type, hash, uploader, category, and state in PostgreSQL, then invoke `03_knowledge_ingestion.json`. A failed Drive write must become a failed job; retries should not create duplicate documents.
5. Extract text, version the document, create stable `asset_ref` and deterministic chunk IDs, and upsert embeddings into Qdrant. Re-ingestion must skip unchanged files and remove obsolete chunks after replacement or deletion.
6. Through authenticated read endpoints, return each document's `asset_ref`, title, kind, MIME, Drive source URL, version, `ingestion_status`, `last_synced_at`, and safe error message. Only authorized team members may see CV metadata or access Drive files.
7. `04_rag_search.json` and `05_requirement_matching.json` retrieve evidence per tender requirement. Deduplicate by document, distinguish CVs from project references, and cite the original Drive file. Do not infer candidate availability or unsupported certifications.

The required workflows and live dashboard endpoints are not implemented in this checkout. The workflow inventory and acceptance gates are in [Plan.md](../Plan.md) and [Truth.md](../Truth.md).

## Acceptance checks

- Upload at least two CVs, two projects, and one expertise profile from the dashboard; verify each original in the approved Drive folder and its metadata in PostgreSQL.
- Confirm a failed or duplicate upload yields an accurate job state without duplicate Drive files or vector chunks.
- Change and delete a source; verify old chunks are retired and the dashboard status reflects the result.
- Retrieve expected evidence in French and English, with a working Drive source link for an authorized user.
- Confirm anonymous and unauthorized users cannot upload, list, or download CV content.
