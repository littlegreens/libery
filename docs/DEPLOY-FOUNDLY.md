# Deploy libery.foundly.it (server Hestia)

**Regola:** non fermare, non riavviare, non modificare processi di altri siti (es. pinewood su `:3001`, altro su `:3000`).

## Percorsi

| Cosa | Path |
|------|------|
| Root sito Hestia | `/home/gabverdini/web/libery.foundly.it` |
| Client (static) | `.../public_html` |
| Codice + API | `.../app` (clone git) |
| Upload | `.../uploads` |

## Porta API Libery

- **3012** (default nello script) — **non** usare 3000/3001 (occupate da altri progetti).
- In `server/.env`: `PORT=3012`
- In Nginx (solo dominio `libery.foundly.it`): `proxy_pass http://127.0.0.1:3012;`

## Redis / Postgres (già sul server)

- Postgres: `127.0.0.1:5432` — crea DB **libery** da Hestia (dedicato).
- Redis: `PONG` su 6379 — usa index dedicato: `REDIS_URL=redis://127.0.0.1:6379/2`

## Node (già installato per root)

```text
/root/.nvm/versions/node/v20.20.1/bin/node
```

PM2 è nella stessa cartella. Lo script `deploy/setup-foundly.sh` usa solo quella path.

## PM2 — solo Libery

```bash
# MAI:
pm2 restart all
pm2 stop 3030829
pm2 delete pinewood ...

# SOLO:
pm2 restart libery-api libery-worker
pm2 logs libery-api
```

## Prima installazione (manuale, sicura)

```bash
# 1. Clone (non tocca altri siti)
mkdir -p /home/gabverdini/web/libery.foundly.it/app
cd /home/gabverdini/web/libery.foundly.it/app
git clone https://github.com/littlegreens/libery.git .
git checkout deploy/foundly-it

# 2. Env (Hestia: crea DB libery + utente, poi incolla DATABASE_URL)
cp server/.env.example server/.env
nano server/.env
# PORT=3012
# CLIENT_URL=https://libery.foundly.it
# REDIS_URL=redis://127.0.0.1:6379/2
# UPLOAD_DIR=/home/gabverdini/web/libery.foundly.it/uploads

# 3. Deploy
export LIBERY_PORT=3012
bash deploy/setup-foundly.sh

# 4. Nginx — solo file dominio libery.foundly.it (Hestia → Advanced)
#    deploy/nginx-libery.conf.example → proxy 3012
```

## Cosa NON facciamo

- Non kill di PID altrui
- Non `docker compose` del repo in produzione
- Non modificare `nginx.conf` globale o altri domini
- Non riusare porta 3001
