BEGIN;

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS lease_owner UUID;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS documents_jobs_idx ON public.documents(next_attempt_at)
    WHERE status = 'processing';

-- A durable queue: one worker claims a row, and expired leases recover after a crash.
CREATE OR REPLACE FUNCTION public.claim_document_job(worker_id UUID)
RETURNS SETOF public.documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE documents SET status = 'failed', lease_owner = NULL, lease_expires_at = NULL,
        processing_error = 'Processing stopped after three attempts. Retry the document.'
    WHERE status = 'processing' AND attempts >= 3
        AND (lease_expires_at IS NULL OR lease_expires_at < now());

    RETURN QUERY
    WITH candidate AS (
        SELECT id FROM documents
        WHERE status = 'processing' AND attempts < 3 AND next_attempt_at <= now()
            AND (lease_expires_at IS NULL OR lease_expires_at < now())
        ORDER BY next_attempt_at, created_at
        FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE documents d SET lease_owner = worker_id,
        lease_expires_at = now() + interval '15 minutes', attempts = d.attempts + 1
    FROM candidate WHERE d.id = candidate.id RETURNING d.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.docmind_schema_version()
RETURNS INTEGER LANGUAGE sql STABLE SET search_path = public AS $$ SELECT 2; $$;

REVOKE ALL ON FUNCTION public.claim_document_job(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.docmind_schema_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_document_job(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.docmind_schema_version() TO service_role;
COMMIT;
