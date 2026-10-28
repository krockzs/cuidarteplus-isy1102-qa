#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
REPO="${1:-cuidarteplus-isy1102-qa}"
[[ "$REPO" =~ ^[a-zA-Z0-9._-]+$ ]] || { echo 'Nombre de repositorio no válido'; exit 2; }
for c in git gh; do command -v "$c" >/dev/null || { echo "Falta $c. Ejecuta scripts/00-preparar-rizen.sh"; exit 2; }; done
if ! gh auth status >/dev/null 2>&1; then echo 'Autenticación necesaria en GitHub:'; gh auth login; fi
# No subir ficheros secretos ni resultados potencialmente sensibles.
for f in .env BACKEND/.env FRONTEND/.env; do
 if [[ -f "$f" ]] && git check-ignore -q "$f" 2>/dev/null; then :
 elif [[ -f "$f" ]]; then echo "ERROR: $f NO excluido por gitignore"; exit 2; fi
done
if grep -REn '(^INSERT INTO public\.pacientes.*\(|@[[:alnum:]]+\.(com|cl))' BACKEND/sql/dump-cuidarteplus.sql | grep -v 'qa.invalid' >/dev/null; then
  echo 'Revisa el dump: posible registro no sintético. Publicación detenida.'; exit 2
fi
if [[ ! -d .git ]]; then git init -b main; fi
if [[ -n "$(git remote 2>/dev/null)" ]]; then echo 'Repositorio ya tiene remoto. Publicación automática cancelada para no reemplazar trabajo.'; exit 2; fi
git add .
if git diff --cached --name-only | grep -E '(^|/)\.env$|(^|/)node_modules/|(^|/)reportes/|(^|/)evidencias/'; then
 echo 'ERROR: archivos privados detectados en staging'; exit 2
fi
git diff --cached --check
if ! git diff --cached --quiet; then
 git commit -m 'test(qa): add Jest EP3 audit suite and synthetic lab data'
fi
ACCOUNT="$(gh api user -q .login)"
if gh repo view "$ACCOUNT/$REPO" >/dev/null 2>&1; then
 echo "Ya existe $ACCOUNT/$REPO. Se detiene para evitar sobrescribir."; exit 2
fi
printf '\nSe creará PÚBLICO: https://github.com/%s/%s\n' "$ACCOUNT" "$REPO"
printf 'ATENCIÓN: Código intencionalmente vulnerable, exclusivamente para laboratorio local.\n'
read -r -p 'Escribe PUBLICAR para confirmar: ' answer
[[ "$answer" == 'PUBLICAR' ]] || { echo 'Cancelado'; exit 0; }
gh repo create "$REPO" --public --source=. --remote=origin --push \
 --description 'Laboratorio académico ISY1102: Cuidarte+ y suite Jest de auditoría'
echo "[OK] https://github.com/$ACCOUNT/$REPO"
