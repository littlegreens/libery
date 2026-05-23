#!/usr/bin/env bash
# Controllo rapido prima di installare Libery su un server con altri progetti.
# Uso: bash deploy/check-server.sh [PORTA_API_LIBERY]

set -euo pipefail

LIBERY_PORT="${1:-3001}"

echo "=== Libery — verifica conflitti (porta API proposta: ${LIBERY_PORT}) ==="
echo

echo "--- Porte in ascolto (80, 443, 3000-3010, 5432, 6379) ---"
if command -v ss >/dev/null 2>&1; then
  ss -tlnp 2>/dev/null | grep -E ':(80|443|300[0-9]|3010|5432|6379)\s' || echo "(nessuna delle porte standard in lista)"
else
  netstat -tlnp 2>/dev/null | grep -E ':(80|443|300[0-9]|3010|5432|6379)\s' || true
fi
echo

if ss -tlnp 2>/dev/null | grep -q ":${LIBERY_PORT} "; then
  echo "ATTENZIONE: la porta ${LIBERY_PORT} è già occupata. Scegli un'altra PORT in server/.env"
else
  echo "OK: porta ${LIBERY_PORT} libera (o non visibile senza sudo)"
fi
echo

echo "--- PM2 (processi esistenti) ---"
if command -v pm2 >/dev/null 2>&1; then
  pm2 list || true
  if pm2 list 2>/dev/null | grep -qE 'libery-api|libery-worker'; then
    echo "INFO: processi libery già registrati in PM2"
  fi
else
  echo "PM2 non installato"
fi
echo

echo "--- PostgreSQL ---"
if command -v psql >/dev/null 2>&1; then
  psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | tr -d ' ' | grep -v '^$' | head -20 || echo "(impossibile elencare DB senza credenziali)"
else
  echo "psql non in PATH"
fi
echo

echo "--- Redis ---"
if command -v redis-cli >/dev/null 2>&1; then
  redis-cli ping 2>/dev/null || echo "Redis non risponde su default"
else
  echo "redis-cli non installato"
fi
echo

echo "--- Docker (non usare per Libery se hai già Postgres/Redis di sistema) ---"
docker ps --format 'table {{.Names}}\t{{.Ports}}' 2>/dev/null | head -15 || echo "Docker non in uso o non installato"
echo

echo "Fine. Vedi docs/DEPLOY-HESTIA.md sezione «Convivenza con altri siti»."
