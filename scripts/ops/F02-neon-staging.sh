#!/usr/bin/env bash
# Cloud runner only. No credentials in argv, logs, dumps uploaded or shell tracing.
set -euo pipefail
umask 077
[[ ${GITHUB_ACTIONS:-} == true && ${GITHUB_EVENT_NAME:-} == workflow_dispatch ]]
[[ ${GITHUB_REPOSITORY:-} == leon337/vital-familia-pwa ]]
[[ ${GITHUB_REF:-} == refs/heads/main || ${GITHUB_REF:-} == refs/heads/integration ]]
[[ ${GITHUB_ACTOR:-} == leon337 && ${GITHUB_TRIGGERING_ACTOR:-} == leon337 ]]
work=$(mktemp -d "${RUNNER_TEMP:?}/f02.XXXXXXXX")
trap 'rm -rf "$work"' EXIT
export F02_WORK="$work"
# API GET only; metadata must positively identify a non-default child branch.
# No redirect, no retry of writes, no create/reset/delete branch operations.
python3 <<'PY'
import os,json,urllib.request,urllib.parse,pathlib,re
p='patient-band-35892280'; b='br-polished-recipe-b6yh4cw2'
def get(path):
    req=urllib.request.Request('https://console.neon.tech/api/v2/projects/'+p+path,
        headers={'Authorization':'Bearer '+os.environ['NEON_API_KEY']})
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs): raise RuntimeError('redirect denied')
    with urllib.request.build_opener(NoRedirect).open(req,timeout=25) as r: return json.load(r)
try:
    branches=get('/branches')['branches']
    target=next(x for x in branches if x['id']==b)
    assert target['primary'] is False and target.get('parent_id')
    assert target['name'].lower() not in ('main','default','production','prod')
    eps=get('/branches/'+b+'/endpoints')['endpoints']
    ep=next(x for x in eps if x['id']==os.environ['F02_ENDPOINT_ID'])
    assert ep['branch_id']==b and ep['project_id']==p and ep['type']=='read_write'
    assert ep.get('disabled') is False
    host=ep['host']; assert host.endswith('.neon.tech') and host.startswith(ep['id']+'.')
    users=[]
    for kind in ('ADMIN','RUNTIME'):
        u=urllib.parse.urlsplit(os.environ['F02_'+kind+'_URL'])
        q=urllib.parse.parse_qs(u.query,strict_parsing=True)
        assert u.scheme in ('postgres','postgresql') and u.hostname==host
        assert u.port in (None,5432) and not u.fragment
        assert urllib.parse.unquote(u.path[1:])==os.environ['F02_DATABASE']
        assert q=={'sslmode':['verify-full']} # no options/host override/pooler
        user=urllib.parse.unquote(u.username or '')
        assert re.fullmatch('[a-z][a-z0-9_]{0,62}',user) and u.password
        users.append(user)
        # libpq env file: all values shell quoted, no URI in process arguments.
        import shlex
        vals=dict(PGHOST=host,PGPORT='5432',PGDATABASE=os.environ['F02_DATABASE'],
                  PGUSER=user,PGPASSWORD=urllib.parse.unquote(u.password),PGSSLMODE='verify-full',
                  PGCONNECT_TIMEOUT='10',PGOPTIONS='-c statement_timeout=60000 -c lock_timeout=10000')
        pathlib.Path(os.environ['F02_WORK'],kind+'.env').write_text('\n'.join('export '+k+'='+shlex.quote(v) for k,v in vals.items()))
    assert users[0]!=users[1] and 'vital_app' not in users
    pathlib.Path(os.environ['F02_WORK'],'runtime-role').write_text(users[1])
except Exception:
    raise SystemExit('F02 target/credentials validation denied (details suppressed)')
PY
unset F02_ADMIN_URL F02_RUNTIME_URL NEON_API_KEY
admin() { ( source "$work/ADMIN.env"; psql -X -q -v ON_ERROR_STOP=1 "$@" ); }
runtime() { ( source "$work/RUNTIME.env"; psql -X -q -v ON_ERROR_STOP=1 "$@" ); }
# Never stream database errors (may contain SQL/connection details) into Actions logs.
exec 3>&1
exec >"$work/private.log" 2>&1
trap 'rc=$?; if ((rc)); then echo "F02 failed closed; inspect phase and runbook; no automatic destructive rollback." >&3; fi; rm -rf "$work"' EXIT
phase() { echo "F02: $1" >&3; }
phase preflight
runtime -Atc "SELECT current_user" > "$work/runtime-actual"
cmp "$work/runtime-role" <(tr -d '\n' < "$work/runtime-actual")
cat > "$work/preflight.sql" <<'SQL'
SELECT set_config('f02.runtime', :'runtime_role', false);
DO $$ BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION 'requires PG17'; END IF;
 IF EXISTS(SELECT FROM pg_namespace WHERE nspname IN ('app','vital_private')) OR EXISTS(SELECT FROM pg_roles WHERE rolname='vital_app') THEN RAISE EXCEPTION 'baseline already present'; END IF;
 IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f','S')) THEN RAISE EXCEPTION 'database not empty'; END IF;
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema') THEN RAISE EXCEPTION 'unexpected routines'; END IF;
 IF EXISTS(SELECT FROM pg_extension WHERE extname<>'plpgsql') OR NOT EXISTS(SELECT FROM pg_available_extensions WHERE name='pgcrypto') THEN RAISE EXCEPTION 'extension inventory'; END IF;
 IF NOT has_database_privilege(current_user,current_database(),'CREATE') THEN RAISE EXCEPTION 'admin lacks CREATE'; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_setting('f02.runtime') AND rolcanlogin AND rolinherit AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication) THEN RAISE EXCEPTION 'unsafe runtime attributes'; END IF;
 IF EXISTS(SELECT FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_setting('f02.runtime'))) THEN RAISE EXCEPTION 'runtime memberships'; END IF;
 IF has_database_privilege(current_setting('f02.runtime'),current_database(),'CREATE') OR EXISTS(SELECT FROM pg_namespace WHERE nspname !~ '^pg_' AND has_schema_privilege(current_setting('f02.runtime'),oid,'CREATE')) THEN RAISE EXCEPTION 'runtime CREATE'; END IF;
 IF EXISTS(SELECT FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_setting('f02.runtime'))) OR EXISTS(SELECT FROM pg_database WHERE datdba=(SELECT oid FROM pg_roles WHERE rolname=current_setting('f02.runtime'))) THEN RAISE EXCEPTION 'runtime owner'; END IF;
END $$;
SQL
admin -v runtime_role="$(cat "$work/runtime-role")" -f "$work/preflight.sql"
phase backup-before
( source "$work/ADMIN.env"; pg_dump -Fc --no-owner --no-acl > "$work/before.dump" )
# Restore only the public schema of the empty database; provider-managed schemas are excluded.
docker exec "$RECOVERY_CONTAINER" createdb -U postgres before_restore
docker exec -i "$RECOVERY_CONTAINER" pg_restore -U postgres -d before_restore --schema=public --no-owner --no-acl --exit-on-error --single-transaction < "$work/before.dump"
phase atomic-migration
# Strictly normalize ONLY known transaction wrappers and the known include.
python3 <<'PY'
from pathlib import Path
import os
parts=[]
for f in ('db/001_schema.sql','db/003_admission.sql'):
    s=Path(f).read_text(); assert s.splitlines().count('BEGIN;')==1 and s.splitlines().count('COMMIT;')==1
    lines=[]
    for l in s.splitlines():
        if l in ('BEGIN;','COMMIT;',r'\ir 003_admission.sql'): continue
        assert not l.lstrip().startswith('\\'), 'unexpected psql command'
        lines.append(l)
    parts.append('\n'.join(lines))
role=Path(os.environ['F02_WORK'],'runtime-role').read_text()
Path(os.environ['F02_WORK'],'migration.sql').write_text('BEGIN;\nSELECT pg_advisory_xact_lock(20261027,2);\n'+
    Path(os.environ['F02_WORK'],'preflight.sql').read_text()+'\n'+ '\n'.join(parts)+'\nGRANT vital_app TO "'+role+'";\nCOMMIT;\n')
PY
admin -v runtime_role="$(cat "$work/runtime-role")" -f "$work/migration.sql"
phase rls-three-identities-rollback
admin -f db/002_security_test.sql
phase runtime-login-fail-closed
runtime <<'SQL'
BEGIN;
DO $$ BEGIN
 IF current_user=session_user AND NOT pg_has_role(current_user,'vital_app','USAGE') THEN RAISE EXCEPTION 'missing runtime grant'; END IF;
 IF app.actor() IS NOT NULL OR app.require_admission() OR EXISTS(SELECT FROM app.measurements) THEN RAISE EXCEPTION 'anonymous access'; END IF;
 PERFORM set_config('app.actor','fixture-patient-a',true);
 PERFORM set_config('app.actor_signature',repeat('0',64),true);
 IF app.actor() IS NOT NULL THEN RAISE EXCEPTION 'forged actor'; END IF;
 BEGIN PERFORM secret FROM vital_private.actor_keys; RAISE EXCEPTION 'key leaked'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO app.consent_events(patient_id,accepted,version) VALUES('fixture-patient-a',true,'2026-10-27.v1'); RAISE EXCEPTION 'unsigned insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN EXECUTE 'SET ROLE neon_superuser'; RAISE EXCEPTION 'privileged role'; EXCEPTION WHEN insufficient_privilege OR undefined_object THEN NULL; END;
END $$;
ROLLBACK;
BEGIN;
DO $$ BEGIN IF app.actor() IS NOT NULL THEN RAISE EXCEPTION 'session actor retained'; END IF; END $$;
ROLLBACK;
SQL
phase backup-after-and-isolated-restore
( source "$work/ADMIN.env"; pg_dump -Fc --no-owner > "$work/after.dump" )
docker exec "$RECOVERY_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -c 'CREATE ROLE vital_app NOLOGIN NOSUPERUSER NOBYPASSRLS'
docker exec "$RECOVERY_CONTAINER" createdb -U postgres after_restore
docker exec -i "$RECOVERY_CONTAINER" pg_restore -U postgres -d after_restore --no-owner --exit-on-error --single-transaction < "$work/after.dump"
docker exec -i "$RECOVERY_CONTAINER" psql -X -U postgres -d after_restore -v ON_ERROR_STOP=1 < db/002_security_test.sql
# Both origin and restore must remain empty, including signing keys and admissions.
cat > "$work/empty.sql" <<'SQL'
DO $$ DECLARE t record; n bigint; BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('app','vital_private') LOOP
 EXECUTE format('SELECT count(*) FROM %I.%I',t.schemaname,t.tablename) INTO n;
 IF n<>0 THEN RAISE EXCEPTION 'fixture residue'; END IF;
 END LOOP;
 IF (SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto') IS DISTINCT FROM 'vital_private' THEN RAISE EXCEPTION 'pgcrypto schema'; END IF;
END $$;
SQL
admin -f "$work/empty.sql"
docker exec -i "$RECOVERY_CONTAINER" psql -X -U postgres -d after_restore -v ON_ERROR_STOP=1 < "$work/empty.sql"
phase 'PASS: SQL A/B/C, runtime DB denial, transactional fixture rollback, isolated restore; OAuth/HTTP NOT TESTED'
printf 'F02 SHA=%s target=br-polished-recipe-b6yh4cw2 synthetic-only; OAuth/HTTP pending\n' "$GITHUB_SHA" >&3
