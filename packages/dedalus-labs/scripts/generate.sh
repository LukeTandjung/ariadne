#!/usr/bin/env bash

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: ./generate.sh <openapi-spec.yaml>"
  exit 1
fi

SPEC_FILE="$1"
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
PACKAGE_DIR=$(cd -- "${SCRIPT_DIR}/.." &> /dev/null && pwd)

bunx @tim-smart/openapi-gen -s "${SPEC_FILE}" >> "${PACKAGE_DIR}/src/Generated.ts"

bunx eslint --fix "${PACKAGE_DIR}/src/Generated.ts"
