#!/usr/bin/env bash
# SonarQube Community Build 26.10 - instalación nativa y local para ISY1102.
set -Eeuo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

SONARQUBE_RELEASE='26.10.0.133078'
URL="https://binaries.sonarsource.com/Distribution/sonarqube/sonarqube-${SONARQUBE_RELEASE}.zip"
DIR='/opt/cuidarte-sonarqube'
SERVICE='cuidarte-sonarqube.service'
ACCOUNT='cuidarte-sonar'
PROJECT="${HOME}/Downloads/cuidarteplus-isy1102-qa"
LOG_DIR="${PROJECT}/QA/reportes/sonarqube"
if [[ ! -d "$PROJECT" ]]; then
  LOG_DIR="${HOME}/Downloads/cuidarte-sonarqube-reportes"
fi
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/instalacion.txt"
exec > >(tee -a "$LOG") 2>&1
trap 'code=$?; echo "[ERROR] Falló la instalación (código $code), línea $LINENO. Revisa: $LOG"; exit "$code"' ERR

echo '=== SONARQUBE COMMUNITY BUILD 26.10 — NEEBLES OS NATIVO ==='
echo "Fecha: $(date --iso-8601=seconds)"
echo 'Sin Docker. La aplicación Cuidarte+ no se modificará.'
[[ $(id -u) -ne 0 ]] || { echo '[ERROR] Ejecutar con tu usuario normal, sin sudo delante.'; exit 2; }
[[ "$(uname -m)" == x86_64 ]] || { echo '[ERROR] Se requiere Linux x86_64.'; exit 2; }
[[ -f /etc/os-release ]] || { echo '[ERROR] Linux no identificado.'; exit 2; }
# shellcheck disable=SC1091
source /etc/os-release
case "${ID:-}/${ID_LIKE:-}" in
  debian/*|ubuntu/*|*/debian*|*/ubuntu*) ;;
  *) echo "[ERROR] Solo Debian/Ubuntu, encontrado ${ID:-desconocido}."; exit 2 ;;
esac
command -v apt-get >/dev/null || { echo '[ERROR] Falta apt-get.'; exit 2; }
command -v systemctl >/dev/null || { echo '[ERROR] Falta systemd.'; exit 2; }
if [[ -e "$DIR" && ! -f "$DIR/bin/linux-x86-64/sonar.sh" ]]; then
  echo "[ERROR] $DIR ya existe y no parece ser nuestra instalación. No se toca."; exit 2
fi

sudo apt-get update
sudo apt-get install -y ca-certificates curl unzip zip jq procps openjdk-21-jdk-headless
JAVA_BIN="$(update-alternatives --list java | grep '/java-21-' | head -n1 || true)"
[[ -x "$JAVA_BIN" ]] || { echo '[ERROR] No se encontró Java 21 en update-alternatives.'; exit 2; }
"$JAVA_BIN" -version

# Elasticsearch requiere límites elevados. Solo se suben si estaban por debajo del mínimo.
need_map=0; need_files=0
[[ "$(sysctl -n vm.max_map_count)" -ge 524288 ]] || need_map=1
[[ "$(sysctl -n fs.file-max)" -ge 131072 ]] || need_files=1
if ((need_map || need_files)); then
  {
    echo '# Requisitos mínimos de Elasticsearch integrado en SonarQube (laboratorio ISY1102)'
    ((need_map)) && echo 'vm.max_map_count=524288'
    ((need_files)) && echo 'fs.file-max=131072'
    true
  } | sudo tee /etc/sysctl.d/99-cuidarte-sonarqube.conf >/dev/null
  ((need_map)) && sudo sysctl -w vm.max_map_count=524288
  ((need_files)) && sudo sysctl -w fs.file-max=131072
fi

# No reemplazar un servicio previamente asociado al mismo nombre que tenga otra configuración.
if [[ ! -f "/etc/systemd/system/${SERVICE}" ]] && [[ -z "$(systemctl list-unit-files "$SERVICE" --no-legend --no-pager 2>/dev/null | head -n1)" ]]; then
  echo '[INFO] Preparando servicio dedicado.'
fi
if ! id "$ACCOUNT" >/dev/null 2>&1; then
  sudo useradd --system --user-group --no-create-home --home-dir "$DIR" --shell /usr/sbin/nologin "$ACCOUNT"
fi

if [[ ! -f "$DIR/bin/linux-x86-64/sonar.sh" ]]; then
  TEMP="$(mktemp -d)"
  trap 'rm -rf "${TEMP:-}"' EXIT
  echo "[INFO] Descargando distribución oficial $SONARQUBE_RELEASE ..."
  curl -fL --retry 3 --connect-timeout 20 --output "$TEMP/sonarqube.zip" "$URL"
  unzip -tqq "$TEMP/sonarqube.zip"
  unzip -q "$TEMP/sonarqube.zip" -d "$TEMP"
  SRC="$TEMP/sonarqube-$SONARQUBE_RELEASE"
  [[ -f "$SRC/bin/linux-x86-64/sonar.sh" ]] || { echo '[ERROR] Paquete incompatible o incompleto.'; exit 2; }
  sudo mkdir -p "$DIR"
  sudo cp -a "$SRC"/. "$DIR"/
  sudo chown -R "$ACCOUNT:$ACCOUNT" "$DIR"
  sudo chmod 750 "$DIR"
  echo '[OK] SonarQube instalado bajo /opt/cuidarte-sonarqube.'
else
  echo '[OK] Distribución SonarQube ya presente. No se sobrescribe.'
fi

PROPS="$DIR/conf/sonar.properties"
if ! sudo grep -q '^sonar.web.host=127\.0\.0\.1$' "$PROPS"; then
  if sudo grep -q '^sonar.web.host=' "$PROPS"; then
    echo '[ERROR] SonarQube ya tiene otra dirección configurada. No se sobreescribe.'; exit 2
  fi
  printf '\n# ISY1102: restringido a interfaz local; nunca exponer a Tailscale/Internet\nsonar.web.host=127.0.0.1\nsonar.web.port=9000\n' | sudo tee -a "$PROPS" >/dev/null
fi

# Base H2 integrada (únicamente para demostración académica, no producción).
# Java 21 explícito, sin afectar el Java predeterminado del usuario.
sudo tee "/etc/systemd/system/${SERVICE}" >/dev/null <<UNIT
[Unit]
Description=SonarQube Community Build - Cuidarte ISY1102 (nativo/local)
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=$ACCOUNT
Group=$ACCOUNT
WorkingDirectory=$DIR
Environment=SONAR_JAVA_PATH=$JAVA_BIN
ExecStart=/bin/bash $DIR/bin/linux-x86-64/sonar.sh console
Restart=on-failure
RestartSec=8
TimeoutStartSec=240
LimitNOFILE=131072
LimitNPROC=8192
UMask=0027
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE"
echo '[INFO] Servicio habilitado. Comprobando respuesta de SonarQube...'
ready=0
for _ in $(seq 1 90); do
  if ! sudo systemctl is-active --quiet "$SERVICE"; then
    echo '[ERROR] Servicio detenido.'
    sudo journalctl -u "$SERVICE" -n 80 --no-pager || true
    exit 3
  fi
  response="$(curl -fsS --connect-timeout 1 --max-time 3 'http://127.0.0.1:9000/api/system/status' 2>/dev/null || true)"
  case "$response" in
    *'"status":"UP"'*) ready=1; break ;;
  esac
  sleep 2
done
if (( !ready )); then
  echo '[AVISO] El servidor no respondió UP durante la comprobación. Verifica el log antes de analizar.'
  sudo journalctl -u "$SERVICE" -n 80 --no-pager || true
  exit 3
fi
printf '\n[OK] SONARQUBE NATIVO OPERATIVO\n'
echo 'Panel: http://127.0.0.1:9000'
echo 'Primer acceso: admin / admin; cambiar la contraseña al iniciar.'
echo 'Después: Usuario > Mi cuenta > Seguridad > crear un token de usuario.'
echo 'Siguiente: bash ~/Downloads/cuidarte-sonarqube-nativo/02-analizar.sh'
echo "Registro: $LOG"
