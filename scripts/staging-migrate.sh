#!/usr/bin/env bash
# Runner cloud only; PG* supplied by protected environment. Never print connection settings.
set -euo pipefail
[[ "${GOVERNED_TARGET:-}" == 'br-polished-recipe-b6yh4cw2' && "${BACKEND_GATE_APPROVED:-}" == 'true' ]] || exit 1
# Fresh database only. Existing schema requires a reviewed forward migration, never drop/reset.
[[ "$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT to_regnamespace('app') IS NULL AND to_regnamespace('vital_private') IS NULL AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='vital_app')")" == 't' ]] || exit 1
psql -X -v ON_ERROR_STOP=1 -f db/001_schema.sql
# Does not seed production auth keys, enable app, or create login credentials.
