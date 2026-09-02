#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

worker="${SITES_PROJECT_ROOT}/dist/server/index.mjs"

[[ -f "${worker}" ]] || {
  echo "Missing Netlify server entry: dist/server/index.mjs" >&2
  exit 66
}

node --check "${worker}"

echo "Validated Netlify server artifact."
