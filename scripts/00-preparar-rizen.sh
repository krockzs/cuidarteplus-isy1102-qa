#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
echo '=== CUIDARTE+ | DEPENDENCIAS NATIVAS | NEEBLES OS ==='
command -v apt-get >/dev/null || { echo '[ERROR] Se requiere Debian/Ubuntu.'; exit 2; }
# Preservar el Node instalado por el usuario (NVM/u otro gestor).
sudo apt-get update
sudo apt-get install -y ca-certificates curl git unzip zip jq openssl postgresql postgresql-client gh
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  sudo apt-get install -y nodejs npm
fi
node -v; npm -v; psql --version; gh --version | head -1
node -e 'const v=process.versions.node.split(".").map(Number);if(!(v[0]===20&&v[1]>=19||v[0]===22&&v[1]>=12||v[0]>=24)){console.error("[ERROR] Se requiere Node.js 20.19+, 22.12+ o 24+ (Vite 7). Conserva/actualiza tu instalación NVM.");process.exit(2)}'
sudo systemctl enable --now postgresql
if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null; then
  echo '[ERROR] PostgreSQL no escucha en 127.0.0.1:5432. Revisa: pg_lsclusters'
  pg_lsclusters || true
  exit 2
fi
echo '[OK] Debian + PostgreSQL + Node listos. No se utiliza Docker.'
