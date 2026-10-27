-- Run in a disposable synthetic branch as migration owner after 001.
-- psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/002_security_test.sql
BEGIN;
INSERT INTO vital_private.admissions(actor_id,active,invitation_ref) VALUES ('fixture-patient-a',true,'synthetic-invite'),('fixture-patient-b',true,'synthetic-invite'),('fixture-caregiver',true,'synthetic-invite');
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
-- Admission revocation defeats even a valid signature and existing consent/grants.
RESET ROLE;
UPDATE vital_private.admissions SET active=false WHERE actor_id='fixture-patient-a';
SET LOCAL ROLE vital_app;
SELECT pg_temp.fixture_actor('fixture-patient-a');
DO $$ BEGIN
 IF app.actor() IS NOT NULL OR app.require_admission() OR EXISTS(SELECT FROM app.measurements) THEN RAISE EXCEPTION 'revoked admission leaked'; END IF;
 BEGIN INSERT INTO app.consent_events(patient_id,accepted,version) VALUES('fixture-patient-a',true,'2026-10-27.v1'); RAISE EXCEPTION 'revoked admission consent accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO app.sharing_events(patient_id,caregiver_id,active) VALUES('fixture-patient-a','fixture-caregiver',false); RAISE EXCEPTION 'revoked admission sharing accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN SELECT * FROM vital_private.admissions; RAISE EXCEPTION 'allowlist exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO vital_private.admissions VALUES('self-enrolled',true,'forged'); RAISE EXCEPTION 'self enrollment accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT pg_temp.fixture_actor('fixture-uninvited');
DO $$ BEGIN
 IF app.actor() IS NOT NULL OR app.require_admission() THEN RAISE EXCEPTION 'uninvited actor accepted'; END IF;
END $$;
SELECT pg_temp.fixture_actor('fixture-caregiver');
DO $$ BEGIN
 IF app.can_access('fixture-patient-a',false) THEN RAISE EXCEPTION 'revoked patient visible to caregiver'; END IF;
 FOR i IN 1..120 LOOP IF NOT app.take_quota() THEN RAISE EXCEPTION 'quota denied early'; END IF; END LOOP;
 IF app.take_quota() THEN RAISE EXCEPTION 'quota exceeded'; END IF;
END $$;
-- Admission revocation removes an otherwise valid caregiver and cannot be self-restored.
RESET ROLE;
UPDATE vital_private.admissions SET active=false WHERE actor_id='fixture-caregiver';
SET LOCAL ROLE vital_app;
SELECT pg_temp.fixture_actor('fixture-caregiver');
DO $$ BEGIN
 IF app.actor() IS NOT NULL OR app.require_admission() OR EXISTS(SELECT FROM app.measurements) THEN RAISE EXCEPTION 'revoked admission allowed'; END IF;
 BEGIN INSERT INTO vital_private.admissions VALUES('fixture-uninvited',true,'forged');RAISE EXCEPTION 'self admission allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT pg_temp.fixture_actor('fixture-uninvited');
DO $$ BEGIN
 IF app.actor() IS NOT NULL OR app.require_admission() THEN RAISE EXCEPTION 'uninvited actor allowed';END IF;
 BEGIN INSERT INTO app.consent_events(patient_id,accepted,version) VALUES('fixture-uninvited',true,'2026-10-27.v1');RAISE EXCEPTION 'uninvited consent allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
-- Tampering with a GUC must not change authenticated identity.
SELECT set_config('app.actor','fixture-patient-b',true);
DO $$ BEGIN
 IF app.actor() IS NOT NULL OR EXISTS(SELECT FROM app.measurements) THEN RAISE EXCEPTION 'forged actor leaked'; END IF;
 BEGIN SELECT secret FROM vital_private.actor_keys; RAISE EXCEPTION 'key readable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO app.audit_events(actor_id,patient_id,event_type) VALUES('x','x','forged'); RAISE EXCEPTION 'audit forge accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
