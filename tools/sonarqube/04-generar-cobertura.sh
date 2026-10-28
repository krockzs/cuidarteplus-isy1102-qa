#!/usr/bin/env bash
# Cobertura real del backend Cuidarte+: tests HTTP Jest contra API secundaria instrumentada.
# No modifica BACKEND/src, FRONTEND/src, la API habitual (:4444) ni el frontend (:3333).
set -Eeuo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$HOME/Downloads/cuidarteplus-isy1102-qa"
REPORT="$ROOT/QA/reportes/sonarqube"
COV="$REPORT/coverage"
RAW="$COV/v8-raw"
TOOLS="$REPORT/tools-coverage"
LAB_PORT=4455

[[ -f "$ROOT/.env" && -d "$ROOT/BACKEND/src" && -x "$ROOT/QA/node_modules/.bin/jest" ]] || {
  echo '[ERROR] Falta el laboratorio nativo preparado (archivo .env, código o Jest).'; exit 2;
}
for cmd in node npm curl psql grep; do command -v "$cmd" >/dev/null || { echo "[ERROR] Falta $cmd"; exit 2; }; done
[[ -f "$HERE/coverage-hook.cjs" ]] || { echo '[ERROR] Falta coverage-hook.cjs'; exit 2; }
[[ -f "$ROOT/QA/helpers/escucha-local.cjs" ]] || { echo '[ERROR] Falta QA/helpers/escucha-local.cjs. Aplica primero parche de preservación del código base.'; exit 2; }
set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a
[[ "${POSTGRES_DB:-}" == 'cuidarteplus_qa' && "${POSTGRES_USER:-}" == 'cuidarte_qa_app' && "${PORT_POSTGRES:-}" == '5432' ]] || {
  echo '[ERROR] No se permite usar otra base de datos para QA.'; exit 2;
}
if ! PGPASSWORD="$POSTGRES_PASSWORD" psql -X -tA -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c 'SELECT etiqueta FROM qa_lab_marker WHERE id=1' | grep -qx 'CUIDARTE_QA_PUBLIC_20261028'; then
  echo '[ERROR] Base de laboratorio no validada; no se ejecutarán pruebas con mutaciones.'; exit 2
fi
if command -v ss >/dev/null; then
  if ss -H -ltn "sport = :$LAB_PORT" | grep -q .; then
    echo "[ERROR] Puerto $LAB_PORT ocupado. No se detendrá ningún proceso ajeno."; exit 2
  fi
elif curl -fsS --connect-timeout 1 --max-time 2 "http://127.0.0.1:$LAB_PORT/" >/dev/null 2>&1; then
  echo "[ERROR] Puerto $LAB_PORT ocupado."; exit 2
fi
mkdir -p "$TOOLS" "$COV"
if [[ ! -x "$TOOLS/node_modules/.bin/c8" ]]; then
  echo '[INFO] Instalando c8@10.1.3 solo en QA/reportes (excluido de Git).'
  npm install --prefix "$TOOLS" --no-save --no-package-lock --no-audit --no-fund 'c8@10.1.3'
fi

# No confundir los resultados históricos de Jest con esta ejecución para cobertura.
BACKUP="$(mktemp -d)"
mkdir -p "$BACKUP/evidencias"
for f in "$ROOT"/QA/evidencias/T-0[1-9].json; do
  if [[ -f "$f" ]]; then cp -p "$f" "$BACKUP/evidencias/"; fi
done
PID=''
stop_backend() {
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    kill -TERM "$PID" 2>/dev/null || true
    # Esperar salida normal para que V8 pueda escribir cobertura antes de convertirla.
    for _ in $(seq 1 30); do
      kill -0 "$PID" 2>/dev/null || break
      sleep 0.2
    done
    wait "$PID" 2>/dev/null || true
  fi
  PID=''
}
restore_evidence() {
  for f in "$ROOT"/QA/evidencias/T-0[1-9].json; do
    if [[ -f "$f" ]]; then rm -f -- "$f"; fi
  done
  for f in "$BACKUP"/evidencias/T-0[1-9].json; do
    if [[ -f "$f" ]]; then cp -p "$f" "$ROOT/QA/evidencias/"; fi
  done
  rm -rf -- "$BACKUP"
}
cleanup() { stop_backend; restore_evidence; }
trap cleanup EXIT

rm -rf -- "$RAW"
mkdir -p "$RAW"
echo '=== Cobertura real V8 + Jest — Cuidarte+ (backend aislado :4455) ==='
(
  cd "$ROOT/BACKEND"
  exec env DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}" \
    JWT_SECRET="$JWT_SECRET" PORT="$LAB_PORT" NODE_V8_COVERAGE="$RAW" \
    node --require "$ROOT/QA/helpers/escucha-local.cjs" \
    --require "$HERE/coverage-hook.cjs" src/app.js
) > "$COV/backend-coverage.log" 2>&1 &
PID=$!

ready=0
for _ in $(seq 1 30); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo '[ERROR] La API instrumentada se detuvo inesperadamente.'
    tail -n 30 "$COV/backend-coverage.log"
    exit 3
  fi
  if curl --noproxy '*' --silent --fail --max-time 2 "http://127.0.0.1:$LAB_PORT/" >/dev/null; then ready=1; break; fi
  sleep 1
done
if ((ready == 0)); then echo '[ERROR] API :4455 no respondió'; exit 3; fi

echo '[INFO] Ejecutando la suite ampliada de Jest contra la API instrumentada, sin cambiar el servidor habitual.'
set +e
(
  cd "$ROOT/QA"
  QA_ALLOW_MUTATIONS=YES \
  QA_API_URL="http://127.0.0.1:$LAB_PORT" \
  QA_DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}" \
    npm test -- --colors=false
) > "$COV/jest-cobertura.txt" 2>&1
JEST_CODE=$?
set -e
# Jest retornará 1 cuando detecte los defectos reales de Cuidarte+.
if ! grep -Eq 'Tests:.*[0-9]+ total' "$COV/jest-cobertura.txt"; then
  echo '[ERROR] La suite no completó la ejecución. Revisa:'
  echo "       $COV/jest-cobertura.txt"
  tail -n 25 "$COV/jest-cobertura.txt"
  exit 3
fi
echo "[INFO] Jest completó la suite ampliada (código de salida: $JEST_CODE)."
stop_backend
if ! find "$RAW" -maxdepth 1 -name '*.json' -type f | grep -q .; then
  echo '[ERROR] V8 no generó cobertura. Revisa backend-coverage.log'; exit 4
fi

# --all cuenta los archivos no ejecutados como 0%, en vez de inflar el porcentaje.
# Se reporta únicamente código de aplicación, nunca QA ni node_modules.
echo '[INFO] Convirtiendo cobertura V8 a LCOV, HTML y resumen.'
(
  cd "$ROOT"
  "$TOOLS/node_modules/.bin/c8" report \
    --temp-directory "$RAW" \
    --reports-dir "$COV" \
    --src "$ROOT" \
    --include 'BACKEND/src/**/*.js' \
    --extension .js \
    --all \
    --reporter=text \
    --reporter=lcov \
    --reporter=html \
    --reporter=json-summary
) > "$COV/resumen-c8.txt" 2>&1 || {
  echo '[ERROR] c8 no pudo convertir los datos V8.'
  tail -n 50 "$COV/resumen-c8.txt"; exit 4
}
LCOV="$COV/lcov.info"
[[ -s "$LCOV" ]] || { echo '[ERROR] LCOV vacío o ausente.'; exit 4; }
if ! grep -qE '^SF:.*BACKEND/src/' "$LCOV"; then
  echo '[ERROR] LCOV no contiene archivos BACKEND/src: rechazo del reporte.'; exit 4
fi
# Evita importar un informe vacío como si contuviera cobertura real.
if ! awk -F, '/^DA:/ && $2 > 0 {count++} END {exit(count?0:1)}' "$LCOV"; then
  echo '[ERROR] No existen líneas ejecutadas en el LCOV.'; exit 4
fi
printf '\n[OK] Cobertura backend real generada.\n'
echo "LCOV: $LCOV"
echo "HTML: $COV/index.html"
echo "Resumen: $COV/resumen-c8.txt"
echo 'No representa cobertura del frontend: todavía requiere pruebas instrumentadas de React.'
echo 'Siguiente: bash ~/Downloads/cuidarte-sonarqube-nativo/02-analizar.sh'
