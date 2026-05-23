#!/usr/bin/env bash
set -euo pipefail
SITE=/home/gabverdini/web/libery.foundly.it
APP=$SITE/app
PUBLIC=$SITE/public_html
UPLOADS=$SITE/uploads
NODE=/root/.nvm/versions/node/v20.20.1/bin
export PATH="$NODE:$PATH"
LIBERY_PORT=3012

echo "=== Libery install (isolato, porta $LIBERY_PORT) ==="

if ss -tlnp 2>/dev/null | grep -q ":${LIBERY_PORT} "; then
  echo "ERRORE: porta $LIBERY_PORT occupata"
  exit 1
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='libery'" | grep -q 1; then
  DBPASS=$(openssl rand -hex 16)
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE USER libery WITH PASSWORD '${DBPASS}';"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE libery OWNER libery;"
  echo "$DBPASS" > /root/.libery_dbpass
  chmod 600 /root/.libery_dbpass
fi
DBPASS=$(cat /root/.libery_dbpass)
sudo -u postgres psql -d libery -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis;"
sudo -u postgres psql -d libery -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;"
sudo -u postgres psql -d libery -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;" 2>/dev/null || true
sudo -u postgres psql -d libery -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;" 2>/dev/null || true
echo "DB OK"

mkdir -p "$APP" "$UPLOADS"
if [ ! -d "$APP/.git" ]; then
  git clone --branch deploy/foundly-it --depth 1 https://github.com/littlegreens/libery.git "$APP"
else
  cd "$APP"
  git fetch origin deploy/foundly-it
  git checkout deploy/foundly-it
  git pull --ff-only origin deploy/foundly-it || true
fi

JWT_A=$(openssl rand -hex 32)
JWT_R=$(openssl rand -hex 32)

cat > "$APP/server/.env" <<ENV
DATABASE_URL="postgresql://libery:${DBPASS}@127.0.0.1:5432/libery?schema=public"
REDIS_URL="redis://127.0.0.1:6379/2"
JWT_ACCESS_SECRET="${JWT_A}"
JWT_REFRESH_SECRET="${JWT_R}"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"
PORT=${LIBERY_PORT}
NODE_ENV=production
CLIENT_URL="https://libery.foundly.it"
UPLOAD_DIR="${UPLOADS}"
ADMIN_EMAIL="admin@libery.app"
ADMIN_PASSWORD="CHANGE_ADMIN_AFTER_DEPLOY"
ADMIN_DISPLAY_NAME="admin"
GOOGLE_BOOKS_API_KEY=""
SMTP_FROM=""
SMTP_USER=""
SMTP_PASS=""
ENV
chmod 600 "$APP/server/.env"
if [ -f /tmp/libery-secrets.env ]; then
  sed -i '/^GOOGLE_BOOKS_API_KEY=/d;/^SMTP_FROM=/d;/^SMTP_USER=/d;/^SMTP_PASS=/d;/^ADMIN_PASSWORD=/d' "$APP/server/.env"
  cat /tmp/libery-secrets.env >> "$APP/server/.env"
  rm -f /tmp/libery-secrets.env
  echo "Secrets applicati"
fi

cd "$APP"
npm ci
npm run db:generate -w server
npm run build -w server
npm run build -w client
rm -f "$PUBLIC/index.html" "$PUBLIC/robots.txt" 2>/dev/null || true
cp -a client/dist/. "$PUBLIC/"
npm run db:migrate:deploy -w server
npm run seed:admin -w server || true

if pm2 describe libery-api >/dev/null 2>&1; then
  pm2 restart libery-api libery-worker
else
  cd "$APP"
  LIBERY_PORT=$LIBERY_PORT pm2 start deploy/ecosystem.config.cjs
fi
pm2 save

NGINX_INC=/home/gabverdini/conf/web/libery.foundly.it/nginx.ssl.conf_libery
cat > "$NGINX_INC" <<'NGX'
# Libery API — porta 3012
location ^~ /api/ {
    proxy_pass http://127.0.0.1:3012;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10M;
}
NGX

nginx -t
systemctl reload nginx

sleep 2
curl -sf "http://127.0.0.1:${LIBERY_PORT}/api/health" && echo ""
echo "=== Installazione terminata ==="
