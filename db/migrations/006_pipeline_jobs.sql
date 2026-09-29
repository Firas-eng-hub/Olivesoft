-- Apply after inspecting the deployed leads/prospects/matches/artifacts schema.
-- This migration is additive and does not modify existing lead rows.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.pipeline_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  scope text NOT NULL DEFAULT 'team',
  operation text NOT NULL CHECK (operation IN ('intake', 'proposal', 'retry')),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'running', 'completed', 'failed')),
  stage text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, operation, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_intake_request_uq
  ON public.pipeline_jobs (scope, request_hash) WHERE operation = 'intake';
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_active_retry_uq
  ON public.pipeline_jobs (scope, lead_id) WHERE operation = 'retry' AND state IN ('queued','running');
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_active_proposal_uq
  ON public.pipeline_jobs (scope, lead_id) WHERE operation = 'proposal' AND state IN ('queued','running');
CREATE INDEX IF NOT EXISTS pipeline_claim_idx
  ON public.pipeline_jobs (state, next_retry_at, lease_until, created_at);

CREATE TABLE IF NOT EXISTS public.pipeline_lead_identities (
  identity text PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pipeline_stage_results (
  job_id uuid NOT NULL REFERENCES public.pipeline_jobs(id),
  stage text NOT NULL,
  result jsonb NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, stage)
);

CREATE TABLE IF NOT EXISTS public.pipeline_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id text,
  workflow_id text,
  workflow_name text,
  last_node text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pipeline_errors_created_idx ON public.pipeline_errors(created_at DESC);

CREATE TABLE IF NOT EXISTS public.rag_evaluation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id text,
  labelled_queries integer NOT NULL CHECK (labelled_queries > 0),
  hits integer NOT NULL CHECK (hits >= 0 AND hits <= labelled_queries),
  hit_at_5 numeric NOT NULL CHECK (hit_at_5 BETWEEN 0 AND 1),
  results jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.requirement_judgments (
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  requirement_id text NOT NULL,
  label text NOT NULL,
  mandatory boolean NOT NULL DEFAULT true,
  status text NOT NULL CHECK (status IN ('supported', 'partial', 'unsupported', 'unknown')),
  evidence_match_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  evidence_quote text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, requirement_id),
  CHECK (status NOT IN ('supported', 'partial') OR cardinality(evidence_match_ids) > 0)
);

CREATE TABLE IF NOT EXISTS public.pipeline_artifact_bundles (
  job_id uuid PRIMARY KEY REFERENCES public.pipeline_jobs(id),
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  version integer NOT NULL DEFAULT 1,
  template_instance_id text,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'exporting', 'ready', 'failed')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, version)
);

CREATE TABLE IF NOT EXISTS public.pipeline_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.pipeline_artifact_bundles(job_id),
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  kind text NOT NULL CHECK (kind IN ('pptx', 'pdf')),
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  provider_file_id text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, kind),
  UNIQUE (storage_bucket, storage_path),
  CHECK ((kind = 'pdf' AND mime_type = 'application/pdf') OR
         (kind = 'pptx' AND mime_type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'))
);

-- Repeated research updates the latest prospect for a lead.
CREATE OR REPLACE FUNCTION public.persist_prospect(p_payload jsonb)
RETURNS TABLE(lead_id uuid) LANGUAGE plpgsql AS $$
DECLARE v_lead uuid := (p_payload->>'lead_id')::uuid;
BEGIN
  IF v_lead IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid prospect payload' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('prospect:' || v_lead::text,0));
  UPDATE public.prospects SET
    org_name=NULLIF(coalesce(p_payload->'raw'->>'organisation',p_payload->'raw'->>'organization'),''),
    sector=p_payload->>'sector',
    revenue_estimate=CASE WHEN (p_payload->>'revenue_estimate') ~ '^[0-9]+(\.[0-9]+)?$' THEN (p_payload->>'revenue_estimate')::numeric ELSE NULL END,
    projects=coalesce(p_payload->'past_projects','[]'::jsonb),
    partners=coalesce(p_payload->'partners','[]'::jsonb),
    needs=coalesce(p_payload->'domain_needs','[]'::jsonb),
    evidence=coalesce(p_payload->'raw'->'sources','[]'::jsonb),
    partial=coalesce((p_payload->>'partial')::boolean,false),
    warnings=coalesce(p_payload->'warnings','[]'::jsonb),
    retrieved_at=now(),updated_at=now()
  WHERE id=(SELECT p.id FROM public.prospects p WHERE p.lead_id=v_lead ORDER BY p.created_at DESC LIMIT 1);
  IF NOT FOUND THEN
    INSERT INTO public.prospects
      (lead_id,org_name,sector,revenue_estimate,projects,partners,needs,evidence,partial,warnings,retrieved_at)
    VALUES(v_lead,NULLIF(coalesce(p_payload->'raw'->>'organisation',p_payload->'raw'->>'organization'),''),
      p_payload->>'sector',
      CASE WHEN (p_payload->>'revenue_estimate') ~ '^[0-9]+(\.[0-9]+)?$' THEN (p_payload->>'revenue_estimate')::numeric ELSE NULL END,
      coalesce(p_payload->'past_projects','[]'::jsonb),coalesce(p_payload->'partners','[]'::jsonb),
      coalesce(p_payload->'domain_needs','[]'::jsonb),coalesce(p_payload->'raw'->'sources','[]'::jsonb),
      coalesce((p_payload->>'partial')::boolean,false),coalesce(p_payload->'warnings','[]'::jsonb),now());
  END IF;
  RETURN QUERY SELECT v_lead;
END $$;

-- The client supplies a stable key. A repeated payload returns the same job;
-- reuse of the key with a different payload is explicitly reported as conflict.
CREATE OR REPLACE FUNCTION public.queue_tender_intake(p_scope text, p_key text, p_input jsonb)
RETURNS TABLE(job_id uuid, lead_id uuid, status text, conflict boolean)
LANGUAGE plpgsql AS $$
DECLARE
  v_hash text := encode(digest(p_input::text, 'sha256'), 'hex');
  v_identity text;
  v_job public.pipeline_jobs%ROWTYPE;
  v_lead uuid;
BEGIN
  IF p_scope IS NULL OR length(p_scope) NOT BETWEEN 1 AND 80 OR
     p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 200 OR
     jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid intake envelope' USING ERRCODE = '22023';
  END IF;
  IF length(trim(coalesce(p_input->>'title',''))) NOT BETWEEN 4 AND 100 OR
     length(trim(coalesce(p_input->>'organization',''))) NOT BETWEEN 2 AND 80 OR
     length(trim(coalesce(p_input->>'summary',''))) NOT BETWEEN 12 AND 700 OR
     coalesce(p_input->>'source','manual') NOT IN ('manual','ted','tavily','serpapi') OR
     jsonb_typeof(p_input->'requirements') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid tender fields' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_input->'requirements') NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'invalid requirements' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_scope || ':' || p_key, 0));
  SELECT * INTO v_job FROM public.pipeline_jobs j
    WHERE j.scope=p_scope AND j.operation='intake' AND j.idempotency_key=p_key;
  IF FOUND THEN
    RETURN QUERY SELECT v_job.id, v_job.lead_id, v_job.state, v_job.request_hash <> v_hash;
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_scope || ':' || v_hash, 0));
  SELECT * INTO v_job FROM public.pipeline_jobs j
    WHERE j.scope=p_scope AND j.operation='intake' AND j.request_hash=v_hash;
  IF FOUND THEN
    RETURN QUERY SELECT v_job.id, v_job.lead_id, v_job.state, false;
    RETURN;
  END IF;
  v_identity := p_scope || ':' || coalesce(nullif(p_input->>'source_url',''), v_hash);
  PERFORM pg_advisory_xact_lock(hashtextextended(v_identity, 0));
  SELECT i.lead_id INTO v_lead FROM public.pipeline_lead_identities i WHERE i.identity=v_identity;
  IF v_lead IS NULL THEN
    INSERT INTO public.leads(title, source, raw_payload, extracted, relevance_score, status, deadline)
    VALUES (p_input->>'title', coalesce(p_input->>'source','manual'), p_input,
            jsonb_build_object('title',p_input->>'title',
              'organization',p_input->>'organization',
              'summary',p_input->>'summary',
              'requirements',p_input->'requirements',
              'deadline',p_input->'deadline',
              'source_url',p_input->'source_url'),
            0, 'detected', nullif(p_input->>'deadline','')::date)
    RETURNING id INTO v_lead;
    INSERT INTO public.pipeline_lead_identities(identity, lead_id) VALUES(v_identity, v_lead);
  END IF;
  INSERT INTO public.pipeline_jobs(lead_id,scope,operation,idempotency_key,request_hash,input)
  VALUES(v_lead,p_scope,'intake',p_key,v_hash,p_input)
  RETURNING * INTO v_job;
  RETURN QUERY SELECT v_job.id, v_lead, v_job.state, false;
END $$;

CREATE OR REPLACE FUNCTION public.queue_pipeline_retry(p_scope text,p_key text,p_lead uuid)
RETURNS TABLE(job_id uuid,state text,conflict boolean)
LANGUAGE plpgsql AS $$
DECLARE v_job public.pipeline_jobs%ROWTYPE; v_stage text;
BEGIN
  IF p_scope IS NULL OR length(p_scope) NOT BETWEEN 1 AND 80 OR
     p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 200 OR p_lead IS NULL THEN
    RAISE EXCEPTION 'invalid retry envelope' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_scope || ':retry:' || p_lead::text,0));
  SELECT * INTO v_job FROM public.pipeline_jobs j
    WHERE j.scope=p_scope AND j.operation='retry' AND j.idempotency_key=p_key;
  IF FOUND THEN
    RETURN QUERY SELECT v_job.id,v_job.state,v_job.lead_id<>p_lead;
    RETURN;
  END IF;
  SELECT l.status INTO v_stage FROM public.leads l WHERE l.id=p_lead FOR UPDATE;
  IF v_stage IS DISTINCT FROM 'failed' THEN
    RETURN QUERY SELECT NULL::uuid,NULL::text,true;
    RETURN;
  END IF;
  SELECT * INTO v_job FROM public.pipeline_jobs j
    WHERE j.scope=p_scope AND j.operation='retry' AND j.lead_id=p_lead
      AND j.state IN ('queued','running') LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT v_job.id,v_job.state,false;
    RETURN;
  END IF;
  INSERT INTO public.pipeline_jobs(lead_id,scope,operation,idempotency_key,request_hash,input)
  VALUES(p_lead,p_scope,'retry',p_key,encode(digest(p_lead::text,'sha256'),'hex'),jsonb_build_object('lead_id',p_lead))
  RETURNING * INTO v_job;
  RETURN QUERY SELECT v_job.id,v_job.state,false;
END $$;

CREATE OR REPLACE FUNCTION public.queue_pipeline_proposal(p_scope text,p_key text,p_lead uuid)
RETURNS TABLE(job_id uuid,state text,conflict boolean)
LANGUAGE plpgsql AS $$
DECLARE v_job public.pipeline_jobs%ROWTYPE; v_stage text; v_requirements integer;
BEGIN
  IF p_scope IS NULL OR length(p_scope) NOT BETWEEN 1 AND 80 OR
     p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 200 OR p_lead IS NULL THEN
    RAISE EXCEPTION 'invalid proposal request' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_scope || ':proposal:' || p_lead::text,0));
  SELECT * INTO v_job FROM public.pipeline_jobs j
    WHERE j.scope=p_scope AND j.operation='proposal' AND j.idempotency_key=p_key;
  IF FOUND THEN
    RETURN QUERY SELECT v_job.id,v_job.state,v_job.lead_id<>p_lead;
    RETURN;
  END IF;
  SELECT l.status,jsonb_array_length(coalesce(l.extracted->'requirements','[]'::jsonb))
    INTO v_stage,v_requirements FROM public.leads l WHERE l.id=p_lead FOR UPDATE;
  IF v_stage IS DISTINCT FROM 'matched' AND v_stage IS DISTINCT FROM 'proposal_ready' THEN
    RETURN QUERY SELECT NULL::uuid,NULL::text,true;
    RETURN;
  END IF;
  IF (SELECT count(*) FROM public.requirement_judgments j WHERE j.lead_id=p_lead)<>v_requirements THEN
    RETURN QUERY SELECT NULL::uuid,NULL::text,true;
    RETURN;
  END IF;
  SELECT * INTO v_job FROM public.pipeline_jobs j
    WHERE j.scope=p_scope AND j.operation='proposal' AND j.lead_id=p_lead
    ORDER BY j.created_at DESC LIMIT 1;
  IF FOUND AND v_job.state IN ('queued','running','completed') THEN
    RETURN QUERY SELECT v_job.id,v_job.state,false;
    RETURN;
  END IF;
  IF FOUND AND v_job.state='failed' THEN
    UPDATE public.pipeline_jobs SET state='queued',stage='queued',attempts=0,
      next_retry_at=now(),lease_until=NULL,lease_token=NULL,error=NULL,updated_at=now()
      WHERE id=v_job.id RETURNING * INTO v_job;
    RETURN QUERY SELECT v_job.id,v_job.state,false;
    RETURN;
  END IF;
  INSERT INTO public.pipeline_jobs(lead_id,scope,operation,idempotency_key,request_hash,input)
  VALUES(p_lead,p_scope,'proposal',p_key,encode(digest(p_lead::text,'sha256'),'hex'),jsonb_build_object('lead_id',p_lead))
  RETURNING * INTO v_job;
  RETURN QUERY SELECT v_job.id,v_job.state,false;
END $$;

-- SKIP LOCKED and a fencing token prevent two workers from claiming one job.
CREATE OR REPLACE FUNCTION public.claim_pipeline_job()
RETURNS SETOF public.pipeline_jobs LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.pipeline_jobs SET state='failed',lease_until=NULL,lease_token=NULL,
    error=jsonb_build_object('message','Retry limit reached'),updated_at=now()
  WHERE operation IN ('intake','retry','proposal') AND attempts>=3 AND
    ((state='queued' AND next_retry_at<=now()) OR (state='running' AND lease_until<now()));
  RETURN QUERY
  WITH candidate AS (
    SELECT id FROM public.pipeline_jobs
    WHERE operation IN ('intake','retry','proposal') AND attempts<3 AND
      ((state='queued' AND next_retry_at<=now())
       OR (state='running' AND lease_until<now()))
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
  )
  UPDATE public.pipeline_jobs j SET state='running', attempts=j.attempts+1,
    lease_token=gen_random_uuid(), lease_until=now()+interval '5 minutes', updated_at=now()
  FROM candidate WHERE j.id=candidate.id
  RETURNING j.*;
END $$;

-- Stage output and progress are committed together; a stale worker cannot commit.
CREATE OR REPLACE FUNCTION public.complete_pipeline_stage(
  p_job uuid, p_token uuid, p_stage text, p_result jsonb, p_next_stage text, p_done boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.pipeline_jobs SET stage=p_next_stage,
    state=CASE WHEN p_done THEN 'completed' ELSE 'running' END,
    checkpoint=checkpoint || jsonb_build_object(p_stage,p_result),
    lease_until=CASE WHEN p_done THEN NULL ELSE now()+interval '5 minutes' END,
    updated_at=now()
  WHERE id=p_job AND lease_token=p_token AND state='running' AND lease_until>now();
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.pipeline_stage_results(job_id,stage,result)
    VALUES(p_job,p_stage,p_result)
    ON CONFLICT(job_id,stage) DO UPDATE SET result=excluded.result,completed_at=now();
  RETURN true;
END $$;

-- Ready status is a single transaction after both verified storage objects exist.
CREATE OR REPLACE FUNCTION public.finalize_proposal_bundle(p_job uuid,p_token uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_job public.pipeline_jobs%ROWTYPE; v_count integer;
BEGIN
  SELECT * INTO v_job FROM public.pipeline_jobs
    WHERE id=p_job AND operation='proposal' AND state='running'
      AND lease_token=p_token AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT count(*) INTO v_count FROM public.pipeline_artifacts a
    WHERE a.job_id=p_job AND a.verified_at IS NOT NULL AND a.size_bytes>0
      AND ((a.kind='pdf' AND a.mime_type='application/pdf') OR
           (a.kind='pptx' AND a.mime_type='application/vnd.openxmlformats-officedocument.presentationml.presentation'));
  IF v_count<>2 THEN RETURN false; END IF;
  UPDATE public.pipeline_artifact_bundles SET state='ready',updated_at=now()
    WHERE job_id=p_job AND lead_id=v_job.lead_id;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.leads SET status='proposal_ready',updated_at=now()
    WHERE id=v_job.lead_id AND status IN ('matched','proposal_ready');
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN public.complete_pipeline_stage(p_job,p_token,'proposal',
    jsonb_build_object('artifacts',2,'lead_id',v_job.lead_id),'proposal_ready',true);
END $$;

-- Persist one complete matrix and its source rows in a single transaction.
-- Model output is validated in n8n; this function enforces identities and
-- evidence presence again at the database boundary.
CREATE OR REPLACE FUNCTION public.persist_requirement_matrix(p_lead uuid, p_matrix jsonb)
RETURNS TABLE(lead_id uuid, stage text, coverage numeric, unknown_count integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_expected integer;
  v_position integer := 0;
  v_row jsonb;
  v_doc jsonb;
  v_req_id text;
  v_status text;
  v_doc_id uuid;
  v_evidence_ids uuid[];
  v_selected text[];
  v_label text;
  v_mandatory boolean;
  v_quote text;
  v_selected_quote_found boolean;
BEGIN
  IF p_lead IS NULL OR jsonb_typeof(p_matrix) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid requirement matrix' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('match:' || p_lead::text,0));
  SELECT jsonb_array_length(coalesce(l.extracted->'requirements','[]'::jsonb))
    INTO v_expected FROM public.leads l WHERE l.id=p_lead AND l.status='researched' FOR UPDATE;
  IF v_expected IS NULL OR v_expected=0 OR jsonb_array_length(p_matrix)<>v_expected THEN
    RAISE EXCEPTION 'matrix does not cover researched lead' USING ERRCODE='22023';
  END IF;
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_matrix) LOOP
    v_position := v_position+1;
    v_req_id := v_row->>'requirement_id';
    v_status := v_row->>'status';
    SELECT CASE WHEN jsonb_typeof(r.value)='string' THEN trim(r.value #>> '{}')
                ELSE trim(coalesce(r.value->>'label',r.value->>'text',r.value->>'description','')) END,
           CASE WHEN jsonb_typeof(r.value)='string' THEN true
                ELSE coalesce((r.value->>'mandatory')::boolean,true) END
      INTO v_label,v_mandatory
      FROM public.leads l CROSS JOIN LATERAL jsonb_array_elements(l.extracted->'requirements') WITH ORDINALITY r(value,ordinality)
      WHERE l.id=p_lead AND r.ordinality=v_position;
    v_quote := coalesce(v_row->>'quote','');
    IF v_req_id IS DISTINCT FROM 'R-'||lpad(v_position::text,2,'0') OR
       v_status IS NULL OR v_status NOT IN ('supported','partial','unsupported','unknown') OR
       v_row->>'label' IS DISTINCT FROM v_label OR
       coalesce((v_row->>'mandatory')::boolean,true) IS DISTINCT FROM v_mandatory OR
       jsonb_typeof(v_row->'documents') IS DISTINCT FROM 'array' OR
       jsonb_array_length(v_row->'documents')>5 THEN
      RAISE EXCEPTION 'invalid requirement judgment' USING ERRCODE='22023';
    END IF;
    IF jsonb_typeof(v_row->'selected_document_ids') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'invalid evidence selection' USING ERRCODE='22023';
    END IF;
    v_selected := ARRAY(SELECT jsonb_array_elements_text(coalesce(v_row->'selected_document_ids','[]'::jsonb)));
    v_evidence_ids := '{}'::uuid[];
    v_selected_quote_found := false;
    DELETE FROM public.matches m WHERE m.lead_id=p_lead AND m.evidence->>'requirement_id'=v_req_id;
    FOR v_doc IN SELECT value FROM jsonb_array_elements(v_row->'documents') LOOP
      IF v_doc->>'source_bucket' IS NULL OR v_doc->>'source_path' IS NULL OR
         v_doc->>'document_id' IS NULL OR
         v_doc->>'asset_type' NOT IN ('cv','project','stack') THEN
        RAISE EXCEPTION 'invalid source document' USING ERRCODE='22023';
      END IF;
      INSERT INTO public.matches(lead_id,asset_type,asset_ref,document_id,title,evidence,score)
      VALUES(p_lead,v_doc->>'asset_type',v_doc->>'document_id',v_doc->>'document_id',
             coalesce(v_doc->>'title',v_doc->>'document_id'),
             jsonb_build_object('requirement_id',v_req_id,'source','supabase_storage',
               'source_bucket',v_doc->>'source_bucket','source_path',v_doc->>'source_path',
               'section',v_doc->'section','text',v_doc->>'excerpt'),
             least(100,greatest(0,coalesce((v_doc->>'score')::numeric,0)*100)))
      RETURNING id INTO v_doc_id;
      IF v_doc->>'document_id'=ANY(v_selected) THEN
        v_evidence_ids := array_append(v_evidence_ids,v_doc_id);
        IF length(v_quote)>=20 AND position(v_quote IN coalesce(v_doc->>'excerpt',''))>0 THEN
          v_selected_quote_found := true;
        END IF;
      END IF;
    END LOOP;
    IF v_status IN ('supported','partial','unsupported') AND
       (cardinality(v_evidence_ids)=0 OR NOT v_selected_quote_found) THEN
      RAISE EXCEPTION 'judgment requires quoted evidence' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.requirement_judgments
      (lead_id,requirement_id,label,mandatory,status,evidence_match_ids,evidence_quote,note,updated_at)
    VALUES(p_lead,v_req_id,v_label,v_mandatory,
           v_status,v_evidence_ids,v_quote,coalesce(v_row->>'note',''),now())
    ON CONFLICT ON CONSTRAINT requirement_judgments_pkey DO UPDATE SET
      label=excluded.label,mandatory=excluded.mandatory,status=excluded.status,
      evidence_match_ids=excluded.evidence_match_ids,evidence_quote=excluded.evidence_quote,
      note=excluded.note,updated_at=now();
  END LOOP;
  UPDATE public.leads SET status='matched',updated_at=now() WHERE id=p_lead;
  RETURN QUERY SELECT p_lead,'matched'::text,
    round(100*sum(CASE j.status WHEN 'supported' THEN 1 WHEN 'partial' THEN 0.5 ELSE 0 END)/v_expected,0),
    count(*) FILTER(WHERE j.status='unknown')::integer
    FROM public.requirement_judgments j WHERE j.lead_id=p_lead;
END $$;

-- Database credentials used by n8n must be privileged explicitly; never grant
-- these functions to anon/authenticated browser roles.
REVOKE ALL ON FUNCTION public.queue_tender_intake(text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.persist_prospect(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_pipeline_retry(text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_pipeline_proposal(text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_pipeline_job() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_pipeline_stage(uuid,uuid,text,jsonb,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_proposal_bundle(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.persist_requirement_matrix(uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON public.pipeline_jobs, public.pipeline_lead_identities,
  public.pipeline_stage_results, public.pipeline_errors, public.rag_evaluation_runs, public.requirement_judgments,
  public.pipeline_artifact_bundles, public.pipeline_artifacts FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF to_regrole(role_name) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.pipeline_jobs, public.pipeline_lead_identities, public.pipeline_stage_results, public.pipeline_errors, public.rag_evaluation_runs, public.requirement_judgments, public.pipeline_artifact_bundles, public.pipeline_artifacts FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION public.queue_tender_intake(text,text,jsonb), public.persist_prospect(jsonb), public.queue_pipeline_retry(text,text,uuid), public.queue_pipeline_proposal(text,text,uuid), public.claim_pipeline_job(), public.complete_pipeline_stage(uuid,uuid,text,jsonb,text,boolean), public.finalize_proposal_bundle(uuid,uuid) FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION public.persist_requirement_matrix(uuid,jsonb) FROM %I',role_name);
    END IF;
  END LOOP;
END $$;
COMMIT;
