-- Execute as migration owner, NEVER with the application's connection role.
BEGIN;
CREATE ROLE vital_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO vital_app;
-- Separate schema prevents application connections from reading/signing actor assertions.
CREATE SCHEMA vital_private;
REVOKE ALL ON SCHEMA vital_private FROM PUBLIC;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA vital_private;
CREATE TABLE vital_private.actor_keys(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), secret text NOT NULL CHECK(length(secret)>=64));
REVOKE ALL ON vital_private.actor_keys FROM PUBLIC;
-- Key provisioning is a separate gated operation. An empty table denies every actor.
CREATE FUNCTION app.actor() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN current_setting('app.actor_signature',true)=encode(vital_private.hmac(
 txid_current()::text || ':' || current_setting('app.actor',true),secret,'sha256'),'hex')
 THEN nullif(current_setting('app.actor',true),'') END FROM vital_private.actor_keys WHERE singleton
$$;
REVOKE ALL ON FUNCTION app.actor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.actor() TO vital_app;
CREATE SEQUENCE app.authorization_order;
CREATE TABLE app.consent_events (
 seq bigint PRIMARY KEY DEFAULT nextval('app.authorization_order'),
 patient_id text NOT NULL DEFAULT app.actor(),
 accepted boolean NOT NULL, version text NOT NULL CHECK(version='2026-10-27.v1'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE app.sharing_events (
 seq bigint PRIMARY KEY DEFAULT nextval('app.authorization_order'),
 patient_id text NOT NULL, caregiver_id text NOT NULL CHECK(length(caregiver_id) BETWEEN 1 AND 200),
 active boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), CHECK(patient_id<>caregiver_id)
);
CREATE TABLE app.measurements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id text NOT NULL, actor_id text NOT NULL,
 measured_at timestamptz NOT NULL CHECK(measured_at<=now()), payload jsonb NOT NULL,
 CHECK(jsonb_typeof(payload)='object' AND payload @> '{"confirmed":true}'::jsonb),
 CHECK(CASE payload->>'kind' WHEN 'glucose' THEN payload - ARRAY['kind','value','unit','context','measuredAt','confirmed'] = '{}'::jsonb ELSE payload - ARRAY['kind','systolic','diastolic','pulse','context','measuredAt','confirmed'] = '{}'::jsonb END),
 CHECK(CASE payload->>'kind' WHEN 'glucose' THEN coalesce(jsonb_typeof(payload->'value')='number' AND CASE payload->>'unit' WHEN 'mg/dL' THEN (payload->>'value')::numeric BETWEEN 20 AND 600 AND (payload->>'value')::numeric=trunc((payload->>'value')::numeric) WHEN 'mmol/L' THEN (payload->>'value')::numeric BETWEEN 1.1 AND 33.3 ELSE false END,false) ELSE (NOT (payload ? 'pulse') OR payload->'pulse'='null'::jsonb OR coalesce(jsonb_typeof(payload->'pulse')='number' AND (payload->>'pulse')::numeric BETWEEN 30 AND 220 AND (payload->>'pulse')::numeric=trunc((payload->>'pulse')::numeric),false)) END),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(coalesce(payload->>'kind' IN ('glucose','pressure'),false)),
 CHECK(coalesce((payload->>'measuredAt')::timestamptz=measured_at,false)),
 CHECK(coalesce(payload->>'context' IN ('jejum','após refeição','repouso','outro'),false)),
 CHECK(coalesce(CASE payload->>'kind' WHEN 'glucose' THEN true
 ELSE jsonb_typeof(payload->'systolic')='number' AND jsonb_typeof(payload->'diastolic')='number' AND (payload->>'systolic')::numeric=trunc((payload->>'systolic')::numeric) AND (payload->>'diastolic')::numeric=trunc((payload->>'diastolic')::numeric) AND (payload->>'systolic')::int BETWEEN 50 AND 260 AND (payload->>'diastolic')::int BETWEEN 30 AND 160 AND (payload->>'systolic')::int>(payload->>'diastolic')::int END,false))
);
CREATE INDEX ON app.consent_events(patient_id,seq DESC);
CREATE INDEX ON app.sharing_events(patient_id,caregiver_id,seq DESC);
CREATE INDEX ON app.measurements(patient_id,measured_at DESC);
-- Dedicated function owner = migration role, with no application membership.
-- Definer reads only authorization metadata; no dynamic SQL or public search_path.
CREATE FUNCTION app.consent_active(p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
 SELECT coalesce((SELECT accepted AND version='2026-10-27.v1' FROM app.consent_events WHERE patient_id=p ORDER BY seq DESC LIMIT 1),false)
$$;
-- Consent withdrawal invalidates grants permanently: re-consent requires a new grant.
CREATE FUNCTION app.can_access(p text, writing boolean) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
 SELECT app.consent_active(p) AND (p=app.actor() OR (NOT writing AND coalesce((
 SELECT s.active AND s.seq > coalesce((SELECT max(c.seq) FROM app.consent_events c WHERE c.patient_id=p AND NOT c.accepted),0)
 FROM app.sharing_events s WHERE s.patient_id=p AND s.caregiver_id=app.actor()
 ORDER BY s.seq DESC LIMIT 1),false)))
$$;
REVOKE ALL ON FUNCTION app.consent_active(text), app.can_access(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.consent_active(text), app.can_access(text,boolean) TO vital_app;
ALTER TABLE app.consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.sharing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.measurements ENABLE ROW LEVEL SECURITY;
-- Metadata tables deliberately not FORCE: definer owner reads them to avoid RLS recursion.
-- vital_app is not owner and cannot bypass RLS.
ALTER TABLE app.measurements FORCE ROW LEVEL SECURITY;
CREATE POLICY consent_select ON app.consent_events FOR SELECT TO vital_app USING(patient_id=app.actor());
CREATE POLICY consent_insert ON app.consent_events FOR INSERT TO vital_app WITH CHECK(patient_id=app.actor());
CREATE POLICY sharing_select ON app.sharing_events FOR SELECT TO vital_app USING(patient_id=app.actor());
CREATE POLICY sharing_insert ON app.sharing_events FOR INSERT TO vital_app WITH CHECK(patient_id=app.actor() AND (NOT active OR app.consent_active(patient_id)));
CREATE POLICY measurement_select ON app.measurements FOR SELECT TO vital_app USING(app.can_access(patient_id,false));
CREATE POLICY measurement_insert ON app.measurements FOR INSERT TO vital_app WITH CHECK(patient_id=app.actor() AND actor_id=app.actor() AND app.can_access(patient_id,true));
CREATE TABLE app.audit_events (
 seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id text NOT NULL, patient_id text NOT NULL, event_type text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE app.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON app.audit_events FOR SELECT TO vital_app USING(patient_id=app.actor());
CREATE FUNCTION app.audit_append() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
 BEGIN INSERT INTO app.audit_events(actor_id,patient_id,event_type) VALUES(app.actor(),NEW.patient_id,TG_TABLE_NAME); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION app.audit_append() FROM PUBLIC;
CREATE TRIGGER audit AFTER INSERT ON app.measurements FOR EACH ROW EXECUTE FUNCTION app.audit_append();
CREATE TRIGGER audit AFTER INSERT ON app.consent_events FOR EACH ROW EXECUTE FUNCTION app.audit_append();
CREATE TRIGGER audit AFTER INSERT ON app.sharing_events FOR EACH ROW EXECUTE FUNCTION app.audit_append();
CREATE FUNCTION app.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only'; END $$;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON app.measurements FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON app.consent_events FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON app.sharing_events FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON app.audit_events FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
REVOKE ALL ON FUNCTION app.reject_mutation() FROM PUBLIC;
GRANT SELECT ON app.measurements,app.consent_events,app.sharing_events TO vital_app;
GRANT INSERT(patient_id,actor_id,measured_at,payload) ON app.measurements TO vital_app;
GRANT INSERT(patient_id,accepted,version) ON app.consent_events TO vital_app;
GRANT INSERT(patient_id,caregiver_id,active) ON app.sharing_events TO vital_app;
GRANT SELECT ON app.audit_events TO vital_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO vital_app;
COMMIT;
-- Create a separate LOGIN role with TLS and grant vital_app to it; no ownership,
-- CREATE, TRUNCATE, UPDATE, DELETE, superuser or BYPASSRLS. Do not use Neon owner URL.

-- Fresh installations also apply the incremental admission upgrade (psql).
\ir 003_admission.sql
