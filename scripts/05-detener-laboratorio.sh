#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for service in backend frontend; do
  pidfile="$ROOT/.run/${service}.pid"
  [[ -f "$pidfile" ]] || continue
  pid="$(cat "$pidfile")"
  [[ "$pid" =~ ^[0-9]+$ ]] || { echo "PID inválido: $pidfile"; exit 2; }
  # Verificar identidad antes de detener para evitar matar un PID reutilizado.
  cmd="$(ps -p "$pid" -o args= || true)"
  case "$service:$cmd" in
    backend:*'node src/app.js'*|frontend:*'vite.js --host 127.0.0.1'*)
      kill "$pid" 2>/dev/null || true
      echo "[OK] Detenido $service (PID $pid)"
    ;;
    *) echo "[AVISO] PID $pid no parece pertenecer a $service, se omite";;
  esac
  rm -f "$pidfile"
done
echo 'PostgreSQL permanece funcionando para otros proyectos; no se altera el servicio global.'
