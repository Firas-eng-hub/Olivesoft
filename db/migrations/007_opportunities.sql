-- Review and apply after 006_pipeline_jobs.sql. Keep scheduled discovery
-- candidates in Postgres so scans and retries are replay safe.
BEGIN;

CREATE TABLE public.opportunity_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('ted', 'tavily', 'serpapi')),
  external_id text NOT NULL,
  source_url text NOT NULL CHECK (source_url ~ '^https://'),
  title text NOT NULL,
  organization text NOT NULL,
  summary text NOT NULL,
  published_at date,
  deadline date,
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(requirements) = 'array'),
  extraction_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('needs_review', 'queued', 'expired')),
  lead_id uuid REFERENCES public.leads(id),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);
CREATE INDEX opportunity_candidates_status_idx ON public.opportunity_candidates (status, last_seen_at DESC);

CREATE TABLE public.opportunity_acceptances (
  lead_id uuid PRIMARY KEY REFERENCES public.leads(id),
  comments text NOT NULL DEFAULT '' CHECK (length(comments) <= 4000),
  priorities text NOT NULL DEFAULT '' CHECK (length(priorities) <= 2000),
  exclusions text NOT NULL DEFAULT '' CHECK (length(exclusions) <= 2000),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Complete judgments are required before a percentage is shown. The score
-- weights mandatory requirements twice; it is evidence coverage, not a win
-- probability. Unknown-only matrices have no defensible percentage.
CREATE VIEW public.opportunity_profiles AS
SELECT l.id AS lead_id,
  CASE WHEN count(j.requirement_id) = jsonb_array_length(coalesce(l.extracted->'requirements','[]'::jsonb))
       AND count(j.requirement_id) > 0
       AND count(*) FILTER (WHERE j.status IN ('supported','partial','unsupported')) > 0
       THEN round(100 * sum((CASE WHEN j.mandatory THEN 2 ELSE 1 END) *
         (CASE j.status WHEN 'supported' THEN 1 WHEN 'partial' THEN 0.5 ELSE 0 END)) /
         nullif(sum(CASE WHEN j.mandatory THEN 2 ELSE 1 END),0),0)::integer
       ELSE NULL END AS fit_score,
  count(*) FILTER (WHERE j.mandatory AND j.status IN ('unknown','unsupported'))::integer AS mandatory_gaps,
  count(*) FILTER (WHERE j.status = 'unknown')::integer AS unknown_count
FROM public.leads l LEFT JOIN public.requirement_judgments j ON j.lead_id = l.id
GROUP BY l.id, l.extracted;

CREATE VIEW public.opportunity_assessments AS
SELECT p.*,
  CASE WHEN p.fit_score IS NULL THEN 'insufficient_evidence'
       WHEN p.mandatory_gaps > 0 THEN 'review_required'
       WHEN p.fit_score >= 70 THEN 'matches_profile'
       WHEN p.fit_score < 40 THEN 'low_fit'
       ELSE 'review_required' END AS assessment
FROM public.opportunity_profiles p;

CREATE FUNCTION public.accept_opportunity(
  p_lead uuid, p_comments text, p_priorities text, p_exclusions text)
RETURNS TABLE(lead_id uuid, accepted_at timestamptz, conflict boolean)
LANGUAGE plpgsql AS $$
DECLARE v_stage text; v_row public.opportunity_acceptances%ROWTYPE;
BEGIN
  IF p_lead IS NULL OR length(coalesce(p_comments,'')) > 4000 OR
     length(coalesce(p_priorities,'')) > 2000 OR length(coalesce(p_exclusions,'')) > 2000 THEN
    RAISE EXCEPTION 'invalid acceptance' USING ERRCODE='22023';
  END IF;
  SELECT l.status INTO v_stage FROM public.leads l WHERE l.id=p_lead FOR UPDATE;
  IF v_stage IS NULL OR v_stage NOT IN ('matched','proposal_ready') OR
     (SELECT p.fit_score FROM public.opportunity_profiles p WHERE p.lead_id=p_lead) IS NULL THEN
    RETURN QUERY SELECT p_lead,NULL::timestamptz,true;
    RETURN;
  END IF;
  INSERT INTO public.opportunity_acceptances(lead_id,comments,priorities,exclusions)
  VALUES (p_lead,trim(coalesce(p_comments,'')),trim(coalesce(p_priorities,'')),trim(coalesce(p_exclusions,'')))
  ON CONFLICT ON CONSTRAINT opportunity_acceptances_pkey DO UPDATE SET comments=excluded.comments,
    priorities=excluded.priorities,exclusions=excluded.exclusions,updated_at=now()
  RETURNING * INTO v_row;
  RETURN QUERY SELECT v_row.lead_id,v_row.accepted_at,false;
END $$;

-- The caller passes source text plus verbatim requirement excerpts. A candidate
-- enters intake only when every requirement can be found in that source text.
CREATE FUNCTION public.record_discovered_opportunity(p_candidate jsonb)
RETURNS TABLE(candidate_id uuid, lead_id uuid, status text, job_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
  v_source text := lower(p_candidate->>'source');
  v_external_id text := trim(coalesce(p_candidate->>'external_id', ''));
  v_url text := trim(coalesce(p_candidate->>'source_url', ''));
  v_title text := trim(coalesce(p_candidate->>'title', ''));
  v_org text := trim(coalesce(p_candidate->>'organization', ''));
  v_summary text := trim(coalesce(p_candidate->>'summary', ''));
  v_body text := coalesce(p_candidate->>'source_text', '');
  v_requirements jsonb := coalesce(p_candidate->'requirements', '[]'::jsonb);
  v_deadline date;
  v_row public.opportunity_candidates%ROWTYPE;
  v_intake record;
  v_valid boolean;
BEGIN
  IF jsonb_typeof(p_candidate) IS DISTINCT FROM 'object' OR
     v_source NOT IN ('ted', 'tavily', 'serpapi') OR
     length(v_external_id) NOT BETWEEN 1 AND 500 OR
     length(v_url) NOT BETWEEN 12 AND 1000 OR v_url !~ '^https://' OR
     length(v_title) NOT BETWEEN 4 AND 180 OR
     length(v_org) NOT BETWEEN 2 AND 120 OR
     length(v_summary) NOT BETWEEN 12 AND 1000 OR
     jsonb_typeof(v_requirements) IS DISTINCT FROM 'array' OR
     jsonb_array_length(v_requirements) > 50 THEN
    RAISE EXCEPTION 'invalid discovered opportunity' USING ERRCODE = '22023';
  END IF;
  IF p_candidate->>'deadline' ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_deadline := (p_candidate->>'deadline')::date;
  END IF;
  v_valid := length(v_summary) <= 700 AND v_org <> 'Review source' AND
    v_org <> 'Unknown buyer' AND v_deadline IS NOT NULL AND
    v_deadline >= current_date AND jsonb_array_length(v_requirements) BETWEEN 1 AND 50 AND
    length(v_body) >= 20 AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_requirements) AS r(value)
      WHERE length(trim(r.value)) NOT BETWEEN 4 AND 500 OR
            position(lower(trim(r.value)) IN lower(v_body)) = 0
    );
  PERFORM pg_advisory_xact_lock(hashtextextended('discovery:' || v_source || ':' || v_external_id, 0));
  INSERT INTO public.opportunity_candidates
    (source, external_id, source_url, title, organization, summary, published_at,
     deadline, requirements, extraction_evidence, status)
  VALUES
    (v_source, v_external_id, v_url, v_title, v_org, v_summary,
     CASE WHEN p_candidate->>'published_at' ~ '^\d{4}-\d{2}-\d{2}$'
       THEN (p_candidate->>'published_at')::date ELSE NULL END,
     v_deadline, v_requirements,
     coalesce(p_candidate->'extraction_evidence', '[]'::jsonb),
     CASE WHEN v_deadline < current_date THEN 'expired' WHEN v_valid THEN 'queued' ELSE 'needs_review' END)
  ON CONFLICT (source, external_id) DO UPDATE SET
    last_seen_at = now(),
    source_url = excluded.source_url,
    title = excluded.title,
    organization = excluded.organization,
    summary = excluded.summary,
    deadline = excluded.deadline,
    requirements = excluded.requirements,
    extraction_evidence = excluded.extraction_evidence,
    status = CASE WHEN opportunity_candidates.lead_id IS NOT NULL THEN 'queued' ELSE excluded.status END
  RETURNING * INTO v_row;
  IF v_valid AND v_row.lead_id IS NULL THEN
    SELECT * INTO v_intake FROM public.queue_tender_intake(
      'team', 'discovery:' || encode(digest(v_source || ':' || v_external_id, 'sha256'), 'hex'),
      jsonb_build_object('title',left(v_title,100),'organization',left(v_org,80),'summary',v_summary,
        'requirements',v_requirements,'deadline',v_deadline,'source',v_source,'source_url',v_url));
    IF v_intake.conflict THEN
      RAISE EXCEPTION 'discovery intake key conflict' USING ERRCODE = '23505';
    END IF;
    UPDATE public.opportunity_candidates SET lead_id = v_intake.lead_id, status = 'queued'
      WHERE id = v_row.id;
    RETURN QUERY SELECT v_row.id, v_intake.lead_id, 'queued'::text, v_intake.job_id;
  ELSE
    RETURN QUERY SELECT v_row.id, v_row.lead_id, v_row.status, NULL::uuid;
  END IF;
END $$;

CREATE FUNCTION public.complete_opportunity_candidate(
  p_candidate uuid, p_key text, p_input jsonb)
RETURNS TABLE(job_id uuid, lead_id uuid, status text, conflict boolean)
LANGUAGE plpgsql AS $$
DECLARE v_candidate public.opportunity_candidates%ROWTYPE; v_intake record;
BEGIN
  IF p_candidate IS NULL OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 200 OR
     jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid candidate review' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_candidate FROM public.opportunity_candidates c WHERE c.id=p_candidate FOR UPDATE;
  IF v_candidate.id IS NULL OR v_candidate.status='expired' OR
     coalesce(p_input->>'deadline','') < current_date::text THEN
    RETURN QUERY SELECT NULL::uuid,NULL::uuid,'needs_review'::text,true;
    RETURN;
  END IF;
  IF v_candidate.status='queued' AND NOT EXISTS (
    SELECT 1 FROM public.pipeline_jobs j WHERE j.operation='intake' AND
      j.idempotency_key=p_key AND j.lead_id=v_candidate.lead_id) THEN
    RETURN QUERY SELECT NULL::uuid,v_candidate.lead_id,'queued'::text,true;
    RETURN;
  END IF;
  SELECT * INTO v_intake FROM public.queue_tender_intake('team',p_key,
    p_input || jsonb_build_object('source',v_candidate.source,'source_url',v_candidate.source_url));
  IF v_intake.conflict OR (v_candidate.lead_id IS NOT NULL AND v_candidate.lead_id<>v_intake.lead_id) THEN
    RETURN QUERY SELECT v_intake.job_id,v_intake.lead_id,'needs_review'::text,true;
    RETURN;
  END IF;
  UPDATE public.opportunity_candidates SET lead_id=v_intake.lead_id,status='queued'
    WHERE id=p_candidate;
  RETURN QUERY SELECT v_intake.job_id,v_intake.lead_id,'queued'::text,false;
END $$;

REVOKE ALL ON public.opportunity_candidates, public.opportunity_acceptances FROM PUBLIC;
REVOKE ALL ON public.opportunity_profiles, public.opportunity_assessments FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_discovered_opportunity(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_opportunity(uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_opportunity_candidate(uuid,text,jsonb) FROM PUBLIC;
COMMIT;
