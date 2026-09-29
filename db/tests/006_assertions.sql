-- Run on a disposable database after 006_pipeline_jobs.sql.
DO $$
DECLARE
  v_input jsonb := '{"title":"Cloud data tender","organization":"Example Buyer","summary":"Need a documented cloud data integration team.","source":"manual","requirements":["GCP Snowflake Terraform Airflow experience"]}'::jsonb;
  a record;
  b record;
  c record;
  v_claim public.pipeline_jobs%ROWTYPE;
  v_matrix jsonb;
  v_result record;
BEGIN
  SELECT * INTO a FROM public.queue_tender_intake('test','stable-key-0001',v_input);
  SELECT * INTO b FROM public.queue_tender_intake('test','stable-key-0001',v_input);
  IF a.job_id IS DISTINCT FROM b.job_id OR b.conflict OR
     (SELECT count(*) FROM public.leads WHERE id=a.lead_id)<>1 THEN
    RAISE EXCEPTION 'identical intake did not reuse its logical job';
  END IF;
  SELECT * INTO c FROM public.queue_tender_intake('test','stable-key-0001',v_input || '{"title":"Different title"}'::jsonb);
  IF NOT c.conflict OR c.job_id IS DISTINCT FROM a.job_id THEN
    RAISE EXCEPTION 'conflicting intake key was not rejected';
  END IF;
  PERFORM public.persist_prospect(jsonb_build_object('lead_id',a.lead_id,'sector','data','raw',jsonb_build_object('sources','[]'::jsonb)));
  PERFORM public.persist_prospect(jsonb_build_object('lead_id',a.lead_id,'sector','analytics','raw',jsonb_build_object('sources','[]'::jsonb)));
  IF (SELECT count(*) FROM public.prospects WHERE lead_id=a.lead_id)<>1 OR
     (SELECT sector FROM public.prospects WHERE lead_id=a.lead_id)<>'analytics' THEN
    RAISE EXCEPTION 'research replay duplicated prospect';
  END IF;
  SELECT * INTO v_claim FROM public.claim_pipeline_job();
  IF v_claim.id IS DISTINCT FROM a.job_id OR v_claim.attempts<>1 OR v_claim.lease_token IS NULL THEN
    RAISE EXCEPTION 'job claim failed';
  END IF;
  IF public.complete_pipeline_stage(a.job_id,gen_random_uuid(),'research','{}'::jsonb,'researched') THEN
    RAISE EXCEPTION 'stale worker committed a stage';
  END IF;
  IF NOT public.complete_pipeline_stage(a.job_id,v_claim.lease_token,'research','{}'::jsonb,'researched') THEN
    RAISE EXCEPTION 'valid worker could not commit a stage';
  END IF;
  UPDATE public.leads SET status='researched' WHERE id=a.lead_id;
  v_matrix := jsonb_build_array(jsonb_build_object(
    'requirement_id','R-01','label','GCP Snowflake Terraform Airflow experience',
    'mandatory',true,'status','supported',
    'selected_document_ids',jsonb_build_array('projet_13'),
    'quote','GCP Snowflake Terraform Airflow',
    'note','Internal project excerpt directly names all four tools.',
    'documents',jsonb_build_array(jsonb_build_object(
      'document_id','projet_13','asset_type','project','title','Warehouse migration',
      'source_bucket','olivesoft-knowledge','source_path','project/1/projet_13.txt',
      'excerpt','A GCP Snowflake Terraform Airflow project delivered a warehouse.',
      'score',0.9))));
  SELECT * INTO v_result FROM public.persist_requirement_matrix(a.lead_id,v_matrix);
  IF v_result.stage<>'matched' OR v_result.coverage<>100 OR
     (SELECT evidence_quote FROM public.requirement_judgments WHERE lead_id=a.lead_id AND requirement_id='R-01')
       <> 'GCP Snowflake Terraform Airflow' THEN
    RAISE EXCEPTION 'grounded matrix was not persisted';
  END IF;
  RAISE NOTICE 'migration 006 assertions passed for lead %, job %',a.lead_id,a.job_id;
END $$;

DO $$
DECLARE
  v_lead uuid;
  a record;
  b record;
  v_claim public.pipeline_jobs%ROWTYPE;
  v_ok boolean;
BEGIN
  SELECT lead_id INTO v_lead FROM public.pipeline_jobs WHERE idempotency_key='stable-key-0001';
  SELECT * INTO a FROM public.queue_pipeline_proposal('test','proposal-key-001',v_lead);
  SELECT * INTO b FROM public.queue_pipeline_proposal('test','proposal-key-001',v_lead);
  IF a.job_id IS DISTINCT FROM b.job_id OR b.conflict THEN
    RAISE EXCEPTION 'proposal replay did not reuse job';
  END IF;
  SELECT * INTO v_claim FROM public.claim_pipeline_job();
  IF v_claim.id IS DISTINCT FROM a.job_id THEN RAISE EXCEPTION 'proposal claim failed'; END IF;
  INSERT INTO public.pipeline_artifact_bundles(job_id,lead_id,version,template_instance_id,state)
    VALUES(a.job_id,v_lead,1,'olivesoft-native-v1','exporting');
  v_ok := public.finalize_proposal_bundle(a.job_id,v_claim.lease_token);
  IF v_ok THEN RAISE EXCEPTION 'incomplete bundle was finalized'; END IF;
  INSERT INTO public.pipeline_artifacts(job_id,lead_id,kind,mime_type,size_bytes,storage_bucket,storage_path,provider_file_id,sha256,verified_at)
    VALUES(a.job_id,v_lead,'pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation',1000,'test','test/proposal.pptx','test/proposal.pptx',repeat('a',64),now()),
          (a.job_id,v_lead,'pdf','application/pdf',1000,'test','test/proposal.pdf','test/proposal.pdf',repeat('b',64),now());
  v_ok := public.finalize_proposal_bundle(a.job_id,gen_random_uuid());
  IF v_ok THEN RAISE EXCEPTION 'stale proposal worker finalized bundle'; END IF;
  v_ok := public.finalize_proposal_bundle(a.job_id,v_claim.lease_token);
  IF NOT v_ok OR (SELECT status FROM public.leads WHERE id=v_lead)<>'proposal_ready' OR
     (SELECT state FROM public.pipeline_jobs WHERE id=a.job_id)<>'completed' THEN
    RAISE EXCEPTION 'verified bundle did not finalize atomically';
  END IF;
  RAISE NOTICE 'proposal assertions passed for job %',a.job_id;
END $$;
