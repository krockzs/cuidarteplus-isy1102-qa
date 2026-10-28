#!/usr/bin/env bash
set -Eeuo pipefail
R="$HOME/Downloads/cuidarteplus-isy1102-qa/QA/reportes/sonarqube"
[[ -d "$R" ]] || { echo '[ERROR] No hay reportes de SonarQube.'; exit 2; }
OUT="$HOME/Downloads/CUIDARTE_SONAR_EVIDENCIAS_$(date +%Y%m%d_%H%M%S).zip"
# Se excluye el directorio working y tools (escáner, cachés, token en memoria).
files=(instalacion.txt analisis.txt resumen.txt issues.json hotspots.json quality-gate.json metricas.json)
args=()
for f in "${files[@]}"; do [[ -f "$R/$f" ]] && args+=("$R/$f"); done
(( ${#args[@]} > 0 )) || { echo '[ERROR] Aún no hay archivos que empaquetar.'; exit 2; }
zip -j -q "$OUT" "${args[@]}"
echo "[OK] Evidencias: $OUT"
