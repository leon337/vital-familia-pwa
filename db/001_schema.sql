-- Execute as migration owner, NEVER with the application's connection role.
BEGIN;
CREATE ROLE vital_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO vital_app;
CREATE TABLE app.consent_events (
 seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 patient_id text NOT NULL DEFAULT current_setting('app.actor',true),
 accepted boolean NOT NULL, version text NOT NULL CHECK(version='2026-10-27.v1'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE app.sharing_events (
 seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 patient_id text NOT NULL, caregiver_id text NOT NULL CHECK(length(caregiver_id) BETWEEN 1 AND 200),
 active boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), CHECK(patient_id<>caregiver_id)
);
CREATE TABLE app.measurements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id text NOT NULL, actor_id text NOT NULL,
 measured_at timestamptz NOT NULL CHECK(measured_at<=now()), payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(coalesce(payload->>'kind' IN ('glucose','pressure'),false)),
 CHECK(coalesce((payload->>'measuredAt')::timestamptz=measured_at,false)),
 CHECK(coalesce(payload->>'context' IN ('jejum','após refeição','repouso','outro'),false)),
 CHECK(coalesce(CASE payload->>'kind' WHEN 'glucose' THEN (payload->>'value')::int BETWEEN 20 AND 600
 ELSE (payload->>'systolic')::int BETWEEN 50 AND 260 AND (payload->>'diastolic')::int BETWEEN 30 AND 160 AND (payload->>'systolic')::int>(payload->>'diastolic')::int END,false))
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
 SELECT app.consent_active(p) AND (p=current_setting('app.actor',true) OR (NOT writing AND coalesce((
 SELECT s.active AND s.created_at > coalesce((SELECT max(c.created_at) FROM app.consent_events c WHERE c.patient_id=p AND NOT c.accepted),'-infinity'::timestamptz)
 FROM app.sharing_events s WHERE s.patient_id=p AND s.caregiver_id=current_setting('app.actor',true)
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
CREATE POLICY consent_select ON app.consent_events FOR SELECT TO vital_app USING(patient_id=current_setting('app.actor',true));
CREATE POLICY consent_insert ON app.consent_events FOR INSERT TO vital_app WITH CHECK(patient_id=current_setting('app.actor',true));
CREATE POLICY sharing_select ON app.sharing_events FOR SELECT TO vital_app USING(patient_id=current_setting('app.actor',true));
CREATE POLICY sharing_insert ON app.sharing_events FOR INSERT TO vital_app WITH CHECK(patient_id=current_setting('app.actor',true) AND (NOT active OR app.consent_active(patient_id)));
CREATE POLICY measurement_select ON app.measurements FOR SELECT TO vital_app USING(app.can_access(patient_id,false));
CREATE POLICY measurement_insert ON app.measurements FOR INSERT TO vital_app WITH CHECK(patient_id=current_setting('app.actor',true) AND actor_id=current_setting('app.actor',true) AND app.can_access(patient_id,true));
CREATE FUNCTION app.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only'; END $$;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON app.measurements FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON app.consent_events FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON app.sharing_events FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA app TO vital_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO vital_app;
COMMIT;
-- Create a separate LOGIN role with TLS and grant vital_app to it; no ownership,
-- CREATE, TRUNCATE, UPDATE, DELETE, superuser or BYPASSRLS. Do not use Neon owner URL.
