-- Run only in a disposable database after 006_base_fixture.sql and migrations
-- 006_pipeline_jobs.sql and 007_opportunities.sql.
BEGIN;
DO $$
DECLARE
  v_payload jsonb := jsonb_build_object(
    'source','ted','external_id','2026-12345','source_url','https://ted.europa.eu/en/notice/-/detail/2026-12345',
    'title','Cloud integration services','organization','Example Authority',
    'summary','Cloud integration and data platform delivery for public services.',
    'deadline',(current_date+30)::text,
    'requirements',jsonb_build_array('Build secure API integrations','Deliver data platform support'),
    'source_text','Build secure API integrations. Deliver data platform support.');
  v_first record;
  v_second record;
  v_review record;
  v_completed record;
  v_expired record;
  v_fit record;
  v_accept record;
BEGIN
  SELECT * INTO v_first FROM public.record_discovered_opportunity(v_payload);
  IF v_first.status <> 'queued' OR v_first.lead_id IS NULL OR v_first.job_id IS NULL THEN
    RAISE EXCEPTION 'valid notice did not enter durable intake';
  END IF;
  SELECT * INTO v_second FROM public.record_discovered_opportunity(v_payload);
  IF v_second.lead_id IS DISTINCT FROM v_first.lead_id OR
     (SELECT count(*) FROM public.leads) <> 1 OR
     (SELECT count(*) FROM public.pipeline_jobs WHERE operation='intake') <> 1 THEN
    RAISE EXCEPTION 'repeated notice created a duplicate opportunity';
  END IF;
  SELECT * INTO v_review FROM public.record_discovered_opportunity(
    v_payload || '{"external_id":"2026-incomplete","source_url":"https://example.org/incomplete","requirements":[]}'::jsonb);
  IF v_review.status <> 'needs_review' OR v_review.lead_id IS NOT NULL THEN
    RAISE EXCEPTION 'incomplete notice was not held for review';
  END IF;
  IF (SELECT status FROM public.record_discovered_opportunity(
    v_payload || jsonb_build_object('external_id','2026-long-title',
      'source_url','https://example.org/long-title',
      'title',repeat('Cloud integration services ',6)))) <> 'queued' THEN
    RAISE EXCEPTION 'long source title did not enter intake with a bounded lead title';
  END IF;
  SELECT * INTO v_completed FROM public.complete_opportunity_candidate(
    v_review.candidate_id,'review-2026-incomplete',
    jsonb_build_object('title','Cloud integration services','organization','Example Authority',
      'summary','Cloud integration and data platform delivery for public services.',
      'deadline',(current_date+30)::text,
      'requirements',jsonb_build_array('Build secure API integrations')));
  IF v_completed.conflict OR v_completed.lead_id IS NULL OR
     (SELECT status FROM public.opportunity_candidates WHERE id=v_review.candidate_id) <> 'queued' THEN
    RAISE EXCEPTION 'reviewed candidate was not linked to durable intake';
  END IF;
  IF (SELECT job_id FROM public.complete_opportunity_candidate(
    v_review.candidate_id,'review-2026-incomplete',
    jsonb_build_object('title','Cloud integration services','organization','Example Authority',
      'summary','Cloud integration and data platform delivery for public services.',
      'deadline',(current_date+30)::text,
      'requirements',jsonb_build_array('Build secure API integrations')))) IS DISTINCT FROM v_completed.job_id THEN
    RAISE EXCEPTION 'review replay did not return the same job';
  END IF;
  IF (SELECT conflict FROM public.complete_opportunity_candidate(
    v_review.candidate_id,'another-review-key',
    jsonb_build_object('title','Cloud integration services','organization','Example Authority',
      'summary','Cloud integration and data platform delivery for public services.',
      'deadline',(current_date+30)::text,
      'requirements',jsonb_build_array('Build secure API integrations')))) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'linked candidate accepted a second review key';
  END IF;
  SELECT * INTO v_expired FROM public.record_discovered_opportunity(
    v_payload || jsonb_build_object('external_id','2026-expired','source_url','https://example.org/expired','deadline',(current_date-1)::text));
  IF v_expired.status <> 'expired' OR v_expired.lead_id IS NOT NULL THEN
    RAISE EXCEPTION 'expired notice entered intake';
  END IF;
  IF (SELECT fit_score FROM public.opportunity_profiles WHERE lead_id=v_first.lead_id) IS NOT NULL THEN
    RAISE EXCEPTION 'fit score appeared before requirement judgments';
  END IF;
  UPDATE public.leads SET status='matched' WHERE id=v_first.lead_id;
  INSERT INTO public.requirement_judgments
    (lead_id,requirement_id,label,mandatory,status,evidence_match_ids,evidence_quote)
  VALUES
    (v_first.lead_id,'R-01','Build secure API integrations',true,'supported',ARRAY[gen_random_uuid()],'Build secure API integrations'),
    (v_first.lead_id,'R-02','Deliver data platform support',false,'partial',ARRAY[gen_random_uuid()],'Deliver data platform support');
  SELECT * INTO v_fit FROM public.opportunity_assessments WHERE lead_id=v_first.lead_id;
  IF v_fit.fit_score <> 83 OR v_fit.mandatory_gaps <> 0 OR v_fit.assessment <> 'matches_profile' THEN
    RAISE EXCEPTION 'weighted RAG fit is wrong: %',row_to_json(v_fit);
  END IF;
  SELECT * INTO v_accept FROM public.accept_opportunity(v_first.lead_id,'Consider public sector language','Security','No availability claims');
  IF v_accept.conflict OR v_accept.accepted_at IS NULL THEN
    RAISE EXCEPTION 'acceptance was not saved';
  END IF;
  PERFORM public.accept_opportunity(v_first.lead_id,'Revised comments','Security','No availability claims');
  IF (SELECT comments FROM public.opportunity_acceptances WHERE lead_id=v_first.lead_id) <> 'Revised comments' OR
     (SELECT accepted_at FROM public.opportunity_acceptances WHERE lead_id=v_first.lead_id) <> v_accept.accepted_at THEN
    RAISE EXCEPTION 'acceptance update changed identity or failed to save comments';
  END IF;
END $$;
ROLLBACK;
