#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
node QA/scripts/revisar-sintaxis.js
for p in .env BACKEND/.env FRONTEND/.env; do
  if [[ -f "$p" ]]; then echo "Configuración privada: $p (no se publica)"; fi
done
find QA/tests -maxdepth 1 -name 'T-*.test.js' -printf '%f\n' | sort
printf '\nPrueba manual: QA/T-08-MANUAL.md\n'
