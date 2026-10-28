#!/usr/bin/env bash
# Análisis estático aislado: escanea solo código entregado, sin tocar su contenido.
set -Eeuo pipefail
ROOT="${HOME}/Downloads/cuidarteplus-isy1102-qa"
REPORT="$ROOT/QA/reportes/sonarqube"
PROJECT_KEY='cuidarteplus-isy1102-qa'
URL='http://127.0.0.1:9000'
[[ -d "$ROOT/FRONTEND/src" && -d "$ROOT/BACKEND/src" ]] || { echo "[ERROR] Proyecto no encontrado en $ROOT"; exit 2; }
command -v npm >/dev/null || { echo '[ERROR] npm no instalado.'; exit 2; }
command -v curl >/dev/null || { echo '[ERROR] curl no instalado.'; exit 2; }
command -v python3 >/dev/null || { echo '[ERROR] Python no disponible.'; exit 2; }
mkdir -p "$REPORT"
if ! curl -fsS "$URL/api/system/status" | grep -q '"status":"UP"'; then
  echo '[ERROR] SonarQube no está operativo en localhost:9000.'
  echo 'Revisar: sudo systemctl status cuidarte-sonarqube.service --no-pager'
  exit 2
fi

if [[ -z "${SONAR_TOKEN:-}" ]]; then
  printf 'Pega tu token SonarQube (no aparecerá al escribir): '
  IFS= read -rs SONAR_TOKEN
  printf '\n'
fi
[[ -n "$SONAR_TOKEN" ]] || { echo '[ERROR] Token requerido.'; exit 2; }
export SONAR_TOKEN
export SONAR_HOST_URL="$URL"
# Verificación de token sin imprimirlo.
status="$(curl -fsS --max-time 8 -H "Authorization: Bearer ${SONAR_TOKEN}" "$URL/api/authentication/validate" || true)"
if [[ "$status" != *'"valid":true'* ]]; then
  echo '[ERROR] Token no válido. Créalo en http://127.0.0.1:9000 > My Account > Security.'
  exit 2
fi

# Dependencia de pruebas exclusivamente en carpeta ignorada por Git.
TOOLS="$REPORT/tools"
mkdir -p "$TOOLS"
if [[ ! -x "$TOOLS/node_modules/.bin/sonar-scanner-npm" ]]; then
  echo '[INFO] Instalando escáner @sonar/scan@4.4.0, compatible con Node 20.'
  npm install --prefix "$TOOLS" --no-save --no-package-lock --no-audit --no-fund '@sonar/scan@4.4.0'
fi

cd "$ROOT"
mkdir -p "$REPORT/working"
echo '=== ANALISIS SONARQUBE · CUIDARTE+ · FUENTES ORIGINALES ==='
node --version
printf 'Escaneo: BACKEND/src y FRONTEND/src. Excluidos QA, SQL, secretos y dependencias.\n'
set +e
"$TOOLS/node_modules/.bin/sonar-scanner-npm" \
 -Dsonar.projectKey="$PROJECT_KEY" \
 -Dsonar.projectName=CuidartePlus-ISY1102 \
 -Dsonar.projectBaseDir="$ROOT" \
 -Dsonar.sources=BACKEND/src,FRONTEND/src \
 -Dsonar.sourceEncoding=UTF-8 \
 -Dsonar.javascript.lcov.reportPaths=QA/reportes/sonarqube/coverage/lcov.info \
 -Dsonar.host.url="$URL" \
 -Dsonar.working.directory="$REPORT/working" \
 -Dsonar.scm.exclusions.disabled=false \
 -Dsonar.exclusions='**/node_modules/**,**/dist/**,**/coverage/**' \
 2>&1 | tee "$REPORT/analisis.txt"
rc=${PIPESTATUS[0]}
set -e
if ((rc != 0)); then
  echo "[ERROR] Escáner falló con código $rc. Archivo: $REPORT/analisis.txt"
  exit "$rc"
fi

# Esperar procesamiento remoto antes de recopilar resultados.
TASK="$REPORT/working/report-task.txt"
if [[ -f "$TASK" ]]; then
  TASK_ID="$(sed -n 's/^ceTaskId=//p' "$TASK" | head -1)"
  if [[ -n "$TASK_ID" ]]; then
    for _ in $(seq 1 90); do
      state="$(curl -fsS -H "Authorization: Bearer ${SONAR_TOKEN}" --get --data-urlencode "id=${TASK_ID}" "$URL/api/ce/task" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("task",{}).get("status","UNKNOWN"))' 2>/dev/null || echo UNKNOWN)"
      case "$state" in
        SUCCESS) echo '[OK] Procesamiento de análisis completado.'; break ;;
        FAILED|CANCELED) echo "[ERROR] Procesamiento de SonarQube: $state"; exit 3 ;;
      esac
      sleep 2
    done
  fi
fi

AUTH="Authorization: Bearer ${SONAR_TOKEN}"
curl -fsS --get -H "$AUTH" --data-urlencode "componentKeys=${PROJECT_KEY}" --data-urlencode 'ps=100' "$URL/api/issues/search" -o "$REPORT/issues.json" || echo '[AVISO] No se pudieron descargar issues.json'
curl -fsS --get -H "$AUTH" --data-urlencode "projectKey=${PROJECT_KEY}" --data-urlencode 'ps=100' "$URL/api/hotspots/search" -o "$REPORT/hotspots.json" || echo '[AVISO] No se pudieron descargar hotspots.json'
curl -fsS --get -H "$AUTH" --data-urlencode "projectKey=${PROJECT_KEY}" "$URL/api/qualitygates/project_status" -o "$REPORT/quality-gate.json" || echo '[AVISO] No se pudo descargar quality-gate.json'
curl -fsS --get -H "$AUTH" --data-urlencode "component=${PROJECT_KEY}" --data-urlencode 'metricKeys=ncloc,bugs,vulnerabilities,code_smells,duplicated_lines_density,reliability_rating,security_rating,sqale_rating,coverage,line_coverage,branch_coverage,lines_to_cover,uncovered_lines' "$URL/api/measures/component" -o "$REPORT/metricas.json" || echo '[AVISO] No se pudieron descargar métricas.'
python3 "$(dirname "$0")/resumir-sonarqube.py" "$REPORT"
cat <<TXT
[OK] Análisis enviado y evidencias recopiladas.
Panel: $URL/dashboard?id=$PROJECT_KEY
Resumen: $REPORT/resumen.txt
Para empaquetar: bash ~/Downloads/cuidarte-sonarqube-nativo/03-empaquetar.sh
TXT
