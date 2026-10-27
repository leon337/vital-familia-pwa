-- Run in a disposable synthetic branch as migration owner after 001.
-- psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/002_security_test.sql
BEGIN;
SET LOCAL ROLE vital_app;
SELECT set_config('app.actor','fixture-patient-a',true);
DO $$ BEGIN
 IF app.can_access('fixture-patient-a',false) THEN RAISE EXCEPTION 'consent missing allowed'; END IF;
END $$;
INSERT INTO app.consent_events(patient_id,accepted,version) VALUES('fixture-patient-a',true,'2026-10-27.v1');
INSERT INTO app.measurements(patient_id,actor_id,measured_at,payload) VALUES('fixture-patient-a','fixture-patient-a','2026-10-01T10:00:00Z','{"kind":"glucose","value":100,"context":"jejum","measuredAt":"2026-10-01T10:00:00Z"}');
INSERT INTO app.sharing_events(patient_id,caregiver_id,active) VALUES('fixture-patient-a','fixture-caregiver',true);
SELECT set_config('app.actor','fixture-patient-b',true);
DO $$ BEGIN
 IF EXISTS(SELECT FROM app.measurements) THEN RAISE EXCEPTION 'cross-patient leak'; END IF;
 BEGIN
  INSERT INTO app.consent_events(patient_id,accepted,version) VALUES('fixture-patient-a',true,'2026-10-27.v1');
  RAISE EXCEPTION 'forged patient accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('app.actor','fixture-caregiver',true);
DO $$ BEGIN
 IF NOT app.can_access('fixture-patient-a',false) THEN RAISE EXCEPTION 'valid grant rejected'; END IF;
 IF (SELECT count(*) FROM app.measurements)<>1 THEN RAISE EXCEPTION 'grant visibility incorrect'; END IF;
 BEGIN
  INSERT INTO app.measurements(patient_id,actor_id,measured_at,payload) VALUES('fixture-patient-a','fixture-caregiver','2026-10-01T10:00:00Z','{"kind":"glucose","value":100,"context":"jejum","measuredAt":"2026-10-01T10:00:00Z"}');
  RAISE EXCEPTION 'caregiver write accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE app.measurements SET payload='{}';RAISE EXCEPTION 'update accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN DELETE FROM app.measurements;RAISE EXCEPTION 'delete accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN TRUNCATE app.measurements;RAISE EXCEPTION 'truncate accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('app.actor','fixture-patient-a',true);
INSERT INTO app.sharing_events(patient_id,caregiver_id,active) VALUES('fixture-patient-a','fixture-caregiver',false);
SELECT set_config('app.actor','fixture-caregiver',true);
DO $$ BEGIN IF EXISTS(SELECT FROM app.measurements) THEN RAISE EXCEPTION 'revoked grant leaked'; END IF; END $$;
SELECT set_config('app.actor','fixture-patient-a',true);
INSERT INTO app.sharing_events(patient_id,caregiver_id,active) VALUES('fixture-patient-a','fixture-caregiver',true);
INSERT INTO app.consent_events(patient_id,accepted,version) VALUES('fixture-patient-a',false,'2026-10-27.v1');
DO $$ BEGIN IF app.can_access('fixture-patient-a',false) THEN RAISE EXCEPTION 'withdrawal allowed access';END IF;END $$;
INSERT INTO app.consent_events(patient_id,accepted,version) VALUES('fixture-patient-a',true,'2026-10-27.v1');
SELECT set_config('app.actor','fixture-caregiver',true);
DO $$ BEGIN IF app.can_access('fixture-patient-a',false) THEN RAISE EXCEPTION 'reconsent revived old grant';END IF;END $$;
ROLLBACK;
