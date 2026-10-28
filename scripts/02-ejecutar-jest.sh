#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[[ -f .env ]] || { echo '[ERROR] Ejecuta primero scripts/01-laboratorio.sh'; exit 2; }
[[ -x QA/node_modules/.bin/jest ]] || { echo '[ERROR] Jest no instalado. Ejecuta scripts/01-laboratorio.sh'; exit 2; }
set -a
# shellcheck disable=SC1091
source .env
set +a
[[ "$POSTGRES_DB" == 'cuidarteplus_qa' && "$POSTGRES_USER" == 'cuidarte_qa_app' ]] || { echo '[ERROR] BD incorrecta'; exit 2; }
export QA_ALLOW_MUTATIONS=YES
export QA_API_URL="http://127.0.0.1:${PORT_BACKEND:-4444}"
export QA_DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${PORT_POSTGRES:-5432}/${POSTGRES_DB}"
mkdir -p QA/reportes QA/evidencias
rm -f QA/evidencias/T-0[1-9].json QA/reportes/jest-resultados.json
cd QA
set +e
npm run test:json -- --colors=false 2>&1 | tee reportes/jest-consola.txt
code=${PIPESTATUS[0]}
set -e
if [[ ! -s reportes/jest-resultados.json ]]; then echo '[ERROR] Jest no generó JSON. Revisa reportes/jest-consola.txt'; exit 2; fi
node scripts/generar-reporte.js
node - <<'JS'
const r=require('./reportes/jest-resultados.json');
console.log(`Pruebas: ${r.numTotalTests} | Aprobadas: ${r.numPassedTests} | Fallidas: ${r.numFailedTests}`);
if (!r.numTotalTests) process.exitCode=2;
JS
if [[ "$code" -ne 0 ]]; then echo '[INFO] Se encontraron FAIL. Distinguir hallazgos reales de errores de preparación.'; fi
echo "[OK] Reporte: $(pwd)/reportes/reporte-ep3.html"
echo '[INFO] T-08 se realiza manualmente mediante QA/T-08-MANUAL.md'
