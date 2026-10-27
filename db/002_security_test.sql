-- Run in a disposable synthetic branch as migration owner after 001.
-- psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/002_security_test.sql
BEGIN;
INSERT INTO vital_private.actor_keys(secret) VALUES(repeat('synthetic-only-',6));
CREATE FUNCTION pg_temp.fixture_actor(actor text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM set_config('app.actor',actor,true);
 PERFORM set_config('app.actor_signature',(SELECT encode(vital_private.hmac(txid_current()::text || ':' || actor,secret,'sha256'),'hex') FROM vital_private.actor_keys),true);
END $$;
SET LOCAL ROLE vital_app;
SELECT pg_temp.fixture_actor('fixture-patient-a');
DO $$ BEGIN
 IF app.can_access('fixture-patient-a',false) THEN RAISE EXCEPTION 'consent missing allowed'; END IF;
END $$;
INSERT INTO app.consent_events(patient_id,accepted,version) VALUES('fixture-patient-a',true,'2026-10-27.v1');
INSERT INTO app.measurements(patient_id,actor_id,measured_at,payload) VALUES('fixture-patient-a','fixture-patient-a','2026-10-01T10:00:00Z','{"kind":"glucose","value":100,"unit":"mg/dL","confirmed":true,"context":"jejum","measuredAt":"2026-10-01T10:00:00Z"}');
INSERT INTO app.sharing_events(patient_id,caregiver_id,active) VALUES('fixture-patient-a','fixture-caregiver',true);
SELECT pg_temp.fixture_actor('fixture-patient-b');
DO $$ BEGIN
 IF EXISTS(SELECT FROM app.measurements) THEN RAISE EXCEPTION 'cross-patient leak'; END IF;
 BEGIN
  INSERT INTO app.consent_events(patient_id,accepted,version) VALUES('fixture-patient-a',true,'2026-10-27.v1');
  RAISE EXCEPTION 'forged patient accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT pg_temp.fixture_actor('fixture-caregiver');
DO $$ BEGIN
 IF NOT app.can_access('fixture-patient-a',false) THEN RAISE EXCEPTION 'valid grant rejected'; END IF;
 IF (SELECT count(*) FROM app.measurements)<>1 THEN RAISE EXCEPTION 'grant visibility incorrect'; END IF;
 BEGIN
  INSERT INTO app.measurements(patient_id,actor_id,measured_at,payload) VALUES('fixture-patient-a','fixture-caregiver','2026-10-01T10:00:00Z','{"kind":"glucose","value":100,"unit":"mg/dL","confirmed":true,"context":"jejum","measuredAt":"2026-10-01T10:00:00Z"}');
  RAISE EXCEPTION 'caregiver write accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE app.measurements SET payload='{}';RAISE EXCEPTION 'update accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN DELETE FROM app.measurements;RAISE EXCEPTION 'delete accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN TRUNCATE app.measurements;RAISE EXCEPTION 'truncate accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT pg_temp.fixture_actor('fixture-patient-a');
INSERT INTO app.sharing_events(patient_id,caregiver_id,active) VALUES('fixture-patient-a','fixture-caregiver',false);
SELECT pg_temp.fixture_actor('fixture-caregiver');
DO $$ BEGIN IF EXISTS(SELECT FROM app.measurements) THEN RAISE EXCEPTION 'revoked grant leaked'; END IF; END $$;
SELECT pg_temp.fixture_actor('fixture-patient-a');
INSERT INTO app.sharing_events(patient_id,caregiver_id,active) VALUES('fixture-patient-a','fixture-caregiver',true);
INSERT INTO app.consent_events(patient_id,accepted,version) VALUES('fixture-patient-a',false,'2026-10-27.v1');
DO $$ BEGIN IF app.can_access('fixture-patient-a',false) THEN RAISE EXCEPTION 'withdrawal allowed access';END IF;END $$;
INSERT INTO app.consent_events(patient_id,accepted,version) VALUES('fixture-patient-a',true,'2026-10-27.v1');
SELECT pg_temp.fixture_actor('fixture-caregiver');
DO $$ BEGIN IF app.can_access('fixture-patient-a',false) THEN RAISE EXCEPTION 'reconsent revived old grant';END IF;END $$;
-- Tampering with a GUC must not change authenticated identity.
SELECT set_config('app.actor','fixture-patient-a',true);
DO $$ BEGIN
 IF app.actor() IS NOT NULL OR EXISTS(SELECT FROM app.measurements) THEN RAISE EXCEPTION 'forged actor leaked'; END IF;
 BEGIN SELECT secret FROM vital_private.actor_keys; RAISE EXCEPTION 'key readable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO app.audit_events(actor_id,patient_id,event_type) VALUES('x','x','forged'); RAISE EXCEPTION 'audit forge accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
