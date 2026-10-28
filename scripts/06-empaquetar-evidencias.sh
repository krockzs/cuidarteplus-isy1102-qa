#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
command -v zip >/dev/null || { echo '[ERROR] Falta zip: bash scripts/00-preparar-rizen.sh'; exit 2; }
[[ -s QA/reportes/jest-resultados.json ]] || { echo '[ERROR] Primero ejecuta scripts/02-ejecutar-jest.sh'; exit 2; }
DATE="$(date +%Y%m%d_%H%M%S)"
OUT="$HOME/Downloads/CUIDARTE_ISY1102_EVIDENCIAS_${DATE}.zip"
mkdir -p "$HOME/Downloads"
items=(QA/reportes/jest-resultados.json QA/reportes/jest-consola.txt QA/reportes/reporte-ep3.html QA/reportes/resumen-ep3.txt QA/reportes/resumen-ep3.json)
[[ -d QA/evidencias ]] && items+=(QA/evidencias)
zip -q -r "$OUT" "${items[@]}"
echo "[OK] ZIP de evidencias: $OUT"
echo 'No incluye la base de datos, secretos, logs del backend ni código fuente.'
