-- Migration owner only. No accounts are admitted by this migration.
BEGIN;
CREATE TABLE vital_private.admissions (
 actor_id text PRIMARY KEY CHECK(actor_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$'),
 active boolean NOT NULL DEFAULT false,
 invitation_ref text NOT NULL CHECK(length(invitation_ref) BETWEEN 1 AND 200)
);
REVOKE ALL ON vital_private.admissions FROM PUBLIC, vital_app;
-- Operators provision/revoke invitations through a restricted migration connection.
-- UPDATE active=false locks against in-flight requests; no public enrollment API.
CREATE OR REPLACE FUNCTION app.actor() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN current_setting('app.actor_signature',true)=encode(vital_private.hmac(
 txid_current()::text || ':' || current_setting('app.actor',true),secret,'sha256'),'hex')
 AND EXISTS(SELECT FROM vital_private.admissions WHERE actor_id=current_setting('app.actor',true) AND active)
 THEN nullif(current_setting('app.actor',true),'') END FROM vital_private.actor_keys WHERE singleton
$$;
CREATE FUNCTION app.lock_patient_admission(p text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE admitted boolean;
BEGIN
 IF app.actor() IS NULL THEN RETURN false; END IF;
 SELECT active INTO admitted FROM vital_private.admissions WHERE actor_id=p FOR SHARE;
 RETURN coalesce(admitted,false);
END $$;
CREATE FUNCTION app.require_admission() RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT app.lock_patient_admission(app.actor())
$$;
REVOKE ALL ON FUNCTION app.lock_patient_admission(text),app.require_admission() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.lock_patient_admission(text),app.require_admission() TO vital_app;
CREATE OR REPLACE FUNCTION app.can_access(p text, writing boolean) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
 SELECT app.actor() IS NOT NULL AND EXISTS(SELECT FROM vital_private.admissions WHERE actor_id=p AND active)
 AND app.consent_active(p) AND (p=app.actor() OR (NOT writing AND coalesce((
 SELECT s.active AND s.seq > coalesce((SELECT max(c.seq) FROM app.consent_events c WHERE c.patient_id=p AND NOT c.accepted),0)
 FROM app.sharing_events s WHERE s.patient_id=p AND s.caregiver_id=app.actor() ORDER BY s.seq DESC LIMIT 1),false)))
$$;
-- The authorization helper exposes no consent state to unrelated/unadmitted identities.
CREATE OR REPLACE FUNCTION app.consent_active(p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT app.actor() IS NOT NULL AND EXISTS(SELECT 1 FROM vital_private.admissions WHERE actor_id=p AND active)
 AND (p=app.actor() OR coalesce((SELECT active FROM app.sharing_events WHERE patient_id=p AND caregiver_id=app.actor() ORDER BY seq DESC LIMIT 1),false))
 AND coalesce((SELECT accepted AND version='2026-10-27.v1' FROM app.consent_events WHERE patient_id=p ORDER BY seq DESC LIMIT 1),false)
$$;
CREATE TABLE vital_private.request_quotas(actor_id text PRIMARY KEY, window_start timestamptz NOT NULL, requests integer NOT NULL);
REVOKE ALL ON vital_private.request_quotas FROM PUBLIC,vital_app;
CREATE FUNCTION app.take_quota() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer; who text:=app.actor();
BEGIN
 IF who IS NULL THEN RETURN false; END IF;
 INSERT INTO vital_private.request_quotas VALUES(who,clock_timestamp(),1)
 ON CONFLICT(actor_id) DO UPDATE SET
 requests=CASE WHEN vital_private.request_quotas.window_start < clock_timestamp()-interval '1 minute' THEN 1 ELSE least(vital_private.request_quotas.requests+1,121) END,
 window_start=CASE WHEN vital_private.request_quotas.window_start < clock_timestamp()-interval '1 minute' THEN clock_timestamp() ELSE vital_private.request_quotas.window_start END
 RETURNING requests INTO n;
 RETURN n<=120;
END $$;
REVOKE ALL ON FUNCTION app.take_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.take_quota() TO vital_app;
CREATE TABLE app.write_requests(actor_id text NOT NULL,scope text NOT NULL CHECK(scope IN ('records','consent','sharing')),key_hash text NOT NULL CHECK(key_hash ~ '^[a-f0-9]{64}$'),request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),result jsonb NOT NULL,PRIMARY KEY(actor_id,scope,key_hash));
ALTER TABLE app.write_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.write_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY own_request ON app.write_requests TO vital_app USING(actor_id=app.actor()) WITH CHECK(actor_id=app.actor());
GRANT SELECT,INSERT ON app.write_requests TO vital_app;
CREATE INDEX measurements_stable_order ON app.measurements(patient_id,measured_at DESC,id DESC);
COMMIT;
