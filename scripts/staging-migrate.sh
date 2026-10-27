#!/usr/bin/env bash
# Deprecated legacy entrypoint: deny before reading configuration or running SQL.
printf '%s\n' 'Deprecated: use the guarded GitHub Actions staging workflow maintained by BRUNO. Legacy migration/recovery entrypoints are disabled.' >&2
exit 1
