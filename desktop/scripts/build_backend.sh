#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DESKTOP_DIR}/.." && pwd)"
PYTHON_BIN="${REPO_ROOT}/.venv/bin/python"
DIST_DIR="${DESKTOP_DIR}/dist/backend"
BUILD_DIR="${DESKTOP_DIR}/.pyinstaller/build"
SPEC_DIR="${DESKTOP_DIR}/.pyinstaller/spec"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  echo "Missing ${PYTHON_BIN}. Run 'make install' first." >&2
  exit 1
fi

"${PYTHON_BIN}" -m PyInstaller \
  --noconfirm \
  --clean \
  --onefile \
  --name monarch-backend \
  --distpath "${DIST_DIR}" \
  --workpath "${BUILD_DIR}" \
  --specpath "${SPEC_DIR}" \
  --paths "${REPO_ROOT}/backend" \
  --collect-all uvicorn \
  --collect-all fastapi \
  --collect-all starlette \
  --collect-all monarchmoney \
  --add-data "${REPO_ROOT}/backend/app/static:app/static" \
  "${REPO_ROOT}/backend/scripts/run_backend.py"
