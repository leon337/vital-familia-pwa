#!/usr/bin/env bash
# Restore an already decrypted custom-format backup in an isolated cloud runner.
# Backup is sensitive (includes actor key): encrypted storage, restricted access, short retention.
set -euo pipefail
[[ "${BACKEND_GATE_APPROVED:-}" == 'true' && "${RECOVERY_DISPOSABLE_TARGET:-}" == 'true' ]] || exit 1
[[ $# == 1 && -f "$1" ]] || exit 1
[[ "$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT to_regnamespace('app') IS NULL AND to_regnamespace('vital_private') IS NULL")" == 't' ]] || exit 1
# Same dedicated migration owner; vital_app role must be provisioned independently before restore.
pg_restore --exit-on-error --single-transaction --no-owner --dbname="${PGDATABASE:?}" "$1"
# Do not enable auth or reuse restored signing keys; rotate before any application connection.
