#!/usr/bin/env bash
# Deploy Libery su libery.foundly.it — NON tocca altri siti/processi PM2.
# Esegui come root dopo aver creato DB «libery» in Hestia e compilato server/.env
#
#   cd /home/gabverdini/web/libery.foundly.it/app
#   bash deploy/setup-foundly.sh
#
set -euo pipefail

SITE_ROOT="/home/gabverdini/web/libery.foundly.it"
APP_DIR="${SITE_ROOT}/app"
PUBLIC_HTML="${SITE_ROOT}/public_html"
UPLOADS="${SITE_ROOT}/uploads"
NODE_BIN="/root/.nvm/versions/node/v20.20.1/bin"
LIBERY_PORT="${LIBERY_PORT:-3012}"
BRANCH="${LIBERY_BRANCH:-deploy/foundly-it}"
REPO="${LIBERY_REPO:-https://github.com/littlegreens/libery.git}"

export PATH="${NODE_BIN}:${PATH}"

echo "=== Libery deploy (isolato) — porta ${LIBERY_PORT} ==="
echo "NON verranno fermati altri processi Node/PM2."

if ss -tlnp 2>/dev/null | grep -q ":${LIBERY_PORT} "; then
  echo "ERRORE: porta ${LIBERY_PORT} già in uso. Esporta LIBERY_PORT=3013 (o altra libera) e riprova."
  exit 1
fi

if [[ ! -f "${APP_DIR}/server/.env" ]]; then
  echo "ERRORE: crea prima ${APP_DIR}/server/.env (da .env.example)"
  exit 1
fi

# PORT coerente con nginx
if ! grep -q "^PORT=${LIBERY_PORT}" "${APP_DIR}/server/.env" 2>/dev/null; then
  echo "ATTENZIONE: imposta PORT=${LIBERY_PORT} in server/.env (nginx deve usare la stessa porta)"
fi

cd "${APP_DIR}"
npm ci
npm run build -w server
npm run build -w client

echo "=== Copia client in public_html (solo questo dominio) ==="
rm -f "${PUBLIC_HTML}/index.html" "${PUBLIC_HTML}/robots.txt" 2>/dev/null || true
cp -a client/dist/. "${PUBLIC_HTML}/"

mkdir -p "${UPLOADS}"
npm run db:generate -w server
npm run db:migrate:deploy -w server

echo "=== PM2 — solo libery-api e libery-worker (mai restart all) ==="
if "${NODE_BIN}/pm2" describe libery-api &>/dev/null; then
  "${NODE_BIN}/pm2" restart libery-api libery-worker
else
  export LIBERY_PORT
  cd "${APP_DIR}"
  "${NODE_BIN}/pm2" start deploy/ecosystem.config.cjs
fi
"${NODE_BIN}/pm2" save

echo ""
echo "=== Fatto. Prossimo passo: Nginx libery.foundly.it → proxy /api su 127.0.0.1:${LIBERY_PORT} ==="
echo "Vedi deploy/nginx-libery.conf.example"
echo "Test: curl -s https://libery.foundly.it/api/health"
