#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
for cmd in node npm psql pg_isready curl openssl sudo; do command -v "$cmd" >/dev/null || { echo "[ERROR] Falta $cmd. Ejecuta scripts/00-preparar-rizen.sh"; exit 2; }; done
node -e 'const v=process.versions.node.split(".").map(Number);if(!(v[0]===20&&v[1]>=19||v[0]===22&&v[1]>=12||v[0]>=24))process.exit(2)' || { echo '[ERROR] Node incompatible con Vite 7: se requiere 20.19+ / 22.12+ / 24+'; exit 2; }
mkdir -p QA/reportes QA/evidencias .run
if [[ ! -f .env ]]; then
  umask 077
  cat > .env <<EOF
POSTGRES_USER=cuidarte_qa_app
POSTGRES_DB=cuidarteplus_qa
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 48)
PORT_POSTGRES=5432
PORT_BACKEND=4444
PORT_FRONTEND=3333
EOF
  chmod 600 .env
  echo '[OK] .env local generado (excluido de Git).'
fi
set -a
# shellcheck disable=SC1091
source .env
set +a
[[ "$POSTGRES_DB" == 'cuidarteplus_qa' && "$POSTGRES_USER" == 'cuidarte_qa_app' && "$PORT_POSTGRES" == '5432' ]] || { echo '[ERROR] Configuración de BD fuera del laboratorio previsto.'; exit 2; }
[[ "$POSTGRES_PASSWORD" =~ ^[a-f0-9]{48}$ && "$JWT_SECRET" =~ ^[a-f0-9]{96}$ ]] || { echo '[ERROR] .env no coincide con formato de credenciales de laboratorio.'; exit 2; }
pg_isready -h 127.0.0.1 -p "$PORT_POSTGRES" >/dev/null || { echo '[ERROR] PostgreSQL no está disponible; ejecuta 00-preparar-rizen.sh'; exit 2; }
# Usar servicio PostgreSQL ya instalado. Nunca sobrescribir bases ajenas.
DB_EXISTS="$(sudo -u postgres psql -X -tA -v ON_ERROR_STOP=1 -d postgres -c "SELECT COUNT(*) FROM pg_database WHERE datname='cuidarteplus_qa'")"
if [[ "$DB_EXISTS" == '1' ]]; then
  if ! sudo -u postgres psql -X -tA -v ON_ERROR_STOP=1 -d "$POSTGRES_DB" -c "SELECT etiqueta FROM qa_lab_marker WHERE id=1" 2>/dev/null | grep -qx 'CUIDARTE_QA_PUBLIC_20261028'; then
    echo '[ERROR] Existe una base cuidarteplus_qa sin el marcador académico. No se alterará.'; exit 2
  fi
  echo '[OK] Base de laboratorio existente y verificada.'
else
  ROLE_EXISTS="$(sudo -u postgres psql -X -tA -v ON_ERROR_STOP=1 -d postgres -c "SELECT COUNT(*) FROM pg_roles WHERE rolname='cuidarte_qa_app'")"
  if [[ "$ROLE_EXISTS" == '1' ]]; then
    echo '[ERROR] Ya existe rol cuidarte_qa_app pero no existe la base. No se modifica un rol preexistente.'; exit 2
  fi
  # psql quotea identificadores y literales con formato seguro; sin interpolación SQL de contraseñas.
  sudo -u postgres psql -X -v ON_ERROR_STOP=1 -d postgres \
    -v qa_user="$POSTGRES_USER" -v qa_pass="$POSTGRES_PASSWORD" -v qa_db="$POSTGRES_DB" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'qa_user', :'qa_pass') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'qa_db', :'qa_user') \gexec
SQL
  echo '[OK] Rol y base exclusivos creados.'
  PGPASSWORD="$POSTGRES_PASSWORD" psql -X -h 127.0.0.1 -p "$PORT_POSTGRES" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -v ON_ERROR_STOP=1 -f BACKEND/sql/dump-cuidarteplus.sql > QA/reportes/postgresql-inicializacion.txt
fi
PGPASSWORD="$POSTGRES_PASSWORD" psql -X -tA -h 127.0.0.1 -p "$PORT_POSTGRES" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 -c 'SELECT etiqueta FROM qa_lab_marker WHERE id=1' | grep -qx 'CUIDARTE_QA_PUBLIC_20261028' || { echo '[ERROR] Marcador QA inválido'; exit 2; }
if [[ ! -f FRONTEND/.env.local ]]; then
  printf 'VITE_API_URL=http://127.0.0.1:%s\n' "$PORT_BACKEND" > FRONTEND/.env.local
  echo '[OK] API frontend fijada a loopback local.'
fi
echo '=== Instalación de dependencias JavaScript ==='
(cd BACKEND && npm ci --no-audit --no-fund)
(cd FRONTEND && npm ci --no-audit --no-fund)
(cd QA && npm install --no-audit --no-fund)
(cd QA && npm run syntax)
# Servicios separados, ejecutados con el usuario actual y sin privilegios.
for service in backend frontend; do
  pidfile="$ROOT/.run/${service}.pid"
  if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "[OK] $service ya está levantado (PID $(cat "$pidfile"))."
  else
    case "$service" in
      backend)
        if curl --silent --max-time 2 --fail "http://127.0.0.1:${PORT_BACKEND}/" >/dev/null; then echo '[ERROR] Puerto backend ocupado por un proceso no administrado.'; exit 2; fi
        (
          cd "$ROOT/BACKEND"
          nohup env DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${PORT_POSTGRES}/${POSTGRES_DB}" JWT_SECRET="$JWT_SECRET" PORT="$PORT_BACKEND" node src/app.js > "$ROOT/QA/reportes/backend.log" 2>&1 < /dev/null &
          echo $! > "$ROOT/.run/backend.pid"
        )
      ;;
      frontend)
        if curl --silent --max-time 2 "http://127.0.0.1:${PORT_FRONTEND}/" >/dev/null; then echo '[ERROR] Puerto frontend ocupado por proceso no administrado.'; exit 2; fi
        (
          cd "$ROOT/FRONTEND"
          nohup node node_modules/vite/bin/vite.js --host 127.0.0.1 --port "$PORT_FRONTEND" --strictPort > "$ROOT/QA/reportes/frontend.log" 2>&1 < /dev/null &
          echo $! > "$ROOT/.run/frontend.pid"
        )
      ;;
    esac
  fi
done
for target in "http://127.0.0.1:${PORT_BACKEND}/" "http://127.0.0.1:${PORT_FRONTEND}/"; do
  status=0
  for attempt in $(seq 1 25); do
    if curl --silent --fail --max-time 2 "$target" > /dev/null; then status=1; break; fi
    sleep 1
  done
  if [[ "$status" != '1' ]]; then
    echo "[ERROR] No inició $target; revisar QA/reportes/{backend,frontend}.log"; exit 2
  fi
done
printf '\n[OK] Laboratorio nativo disponible (solo 127.0.0.1)\nFrontend: http://127.0.0.1:%s/\nAPI: http://127.0.0.1:%s/docs\n' "$PORT_FRONTEND" "$PORT_BACKEND"
echo 'Ejecutar: bash scripts/02-ejecutar-jest.sh'
