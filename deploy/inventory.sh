#!/usr/bin/env bash
# Esegui sul server Hestia e incolla l'output (maschera password/token).
#   bash deploy/inventory.sh

set -euo pipefail

echo "========== LIBERY — inventario server =========="
echo "Data: $(date -Is 2>/dev/null || date)"
echo "Host: $(hostname -f 2>/dev/null || hostname)"
echo "User: $(whoami)"
echo

echo "=== OS ==="
cat /etc/os-release 2>/dev/null | head -5 || uname -a
echo

echo "=== Node / npm / pm2 ==="
command -v node >/dev/null && node -v || echo "node: NON installato"
command -v npm >/dev/null && npm -v || echo "npm: NON installato"
command -v pm2 >/dev/null && pm2 -v || echo "pm2: NON installato"
command -v pm2 >/dev/null && pm2 list 2>/dev/null || true
echo

echo "=== Porte (80,443,3000-3020,5432,6379) ==="
if command -v ss >/dev/null; then
  ss -tlnp 2>/dev/null | grep -E ':(80|443|300[0-9]|301[0-9]|3020|5432|6379)\s' || echo "(nessuna in elenco)"
else
  netstat -tlnp 2>/dev/null | grep -E ':(80|443|300|5432|6379)' || true
fi
echo

echo "=== PostgreSQL ==="
command -v psql >/dev/null && psql --version || echo "psql: non in PATH"
systemctl is-active postgresql 2>/dev/null || systemctl is-active postgres 2>/dev/null || echo "servizio postgres: (sconosciuto)"
echo "Database (se permesso):"
sudo -u postgres psql -lqt 2>/dev/null | cut -d \| -f 1 | tr -d ' ' | grep -v '^$' | head -25 || echo "(impossibile elencare — usa pannello Hestia)"
echo

echo "=== Redis ==="
command -v redis-cli >/dev/null && redis-cli --version || echo "redis-cli: NON installato"
redis-cli ping 2>/dev/null || echo "Redis: non risponde su 127.0.0.1:6379"
echo

echo "=== Nginx / Hestia ==="
command -v nginx >/dev/null && nginx -v 2>&1 || true
command -v v-list-web-domains >/dev/null && echo "Hestia CLI: sì" || echo "Hestia CLI: (non in PATH per questo user)"
ls -d /home/*/web/*/public_html 2>/dev/null | head -15 || true
echo

echo "=== Docker (se presente) ==="
docker ps --format 'table {{.Names}}\t{{.Ports}}' 2>/dev/null | head -10 || echo "Docker: assente o non usato"
echo

echo "=== Spazio disco (home) ==="
df -h /home 2>/dev/null || df -h .
echo

echo "=== Cartelle progetto candidate ==="
ls -la /home/$(whoami)/ 2>/dev/null | grep -E 'libery|foundly|git|www|app' || ls -la ~ | head -20
echo

echo "========== Fine — incolla tutto in chat (senza password) =========="
