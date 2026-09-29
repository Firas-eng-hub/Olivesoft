-- Run only in a disposable PostgreSQL database before migration 006.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source text NOT NULL,
  raw_payload jsonb NOT NULL,
  extracted jsonb NOT NULL,
  relevance_score numeric NOT NULL,
  status text NOT NULL,
  deadline date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  asset_type text NOT NULL,
  asset_ref text NOT NULL,
  document_id text NOT NULL,
  title text NOT NULL,
  evidence jsonb NOT NULL,
  score numeric NOT NULL
);
CREATE TABLE public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  org_name text,
  sector text,
  revenue_estimate numeric,
  projects jsonb NOT NULL DEFAULT '[]'::jsonb,
  partners jsonb NOT NULL DEFAULT '[]'::jsonb,
  needs jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  partial boolean NOT NULL DEFAULT false,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  retrieved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
