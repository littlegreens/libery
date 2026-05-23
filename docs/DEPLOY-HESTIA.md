# Deploy Libery su server IONOS + Hestia

Dominio provvisorio: **https://libery.foundly.it**

## Convivenza con altri siti (importante)

Su Hestia hai già **Nginx (80/443)**, altri domini, PHP, magari altri Node/PM2, Postgres e Redis. Libery **non deve** rubare porte né sovrascrivere config globali.

### Cosa NON fare

| Evitare | Perché |
|---------|--------|
| `docker compose up` del repo in produzione | Aprirebbe Postgres **5433** e Redis **6379** in conflitto con istanze già attive |
| `pm2 restart all` | Riavvia **tutti** i progetti Node sul server |
| Usare porta **3000/3001** se già occupata | L’API non parte o va in crash loop |
| DB utente `postgres` / DB generico condiviso | Rischio e confusione con altri app |
| Modificare `nginx.conf` globale Hestia | Si rompono gli altri domini; si lavora solo sul **dominio** `libery.foundly.it` |
| Stesso nome PM2 di un altro progetto | Es. non chiamare processi `api` o `worker` generici |

### Cosa fare (isolamento)

1. **Cartella dedicata** — es. `/home/admin/libery` (non dentro `public_html` di foundly.it o altri siti).
2. **Solo Nginx del dominio** — Hestia crea `libery.foundly.it`; aggiungi proxy `/api` solo lì (`deploy/nginx-libery.conf.example`).
3. **Porta API locale dedicata** — default `3001`; se occupata, in `server/.env` metti es. `PORT=3012` e lo stesso numero nel proxy Nginx.
4. **Database dedicato** — utente + DB `libery` (creati da pannello Hestia o SQL sotto); non toccare DB degli altri progetti.
5. **Redis** — se condividi l’istanza Redis del server, usa un **DB index** diverso:
   `REDIS_URL="redis://127.0.0.1:6379/2"`  
   Le code BullMQ hanno prefisso `libery-*` ma l’index evita collisioni con altre app.
6. **PM2 solo processi Libery** (senza Redis: solo API):
   ```bash
   pm2 start deploy/ecosystem.api-only.cjs
   pm2 restart libery-api   # mai «pm2 restart all»
   pm2 logs libery-api
   ```
7. **Postgres di Hestia** — usa l’host/porta che Hestia assegna (spesso `127.0.0.1:5432`). Abilita solo estensione **postgis** sul DB `libery`.

### Controllo prima dell’installazione

Sul server, dalla cartella del progetto:

```bash
bash deploy/check-server.sh 3001
# se 3001 occupata:
bash deploy/check-server.sh 3012
```

### Schema (nessun conflitto sulle porte pubbliche)

```
Internet :443
    └── Nginx Hestia (già attivo per tutti i siti)
            ├── altri-domini.it → altri root PHP/static
            └── libery.foundly.it
                    ├── /     → /home/admin/libery/client/dist
                    └── /api  → 127.0.0.1:PORT (solo Libery, non esposto fuori)

127.0.0.1:PORT     → PM2 libery-api
127.0.0.1:5432     → Postgres (DB libery dedicato)
127.0.0.1:6379/2   → Redis (opzionale, fase 2)
```

Libery **non apre** porte 80/443: le usa solo Nginx che è già in esecuzione.

## Cosa serve sul server

| Componente | Perché | Note Hestia |
|------------|--------|-------------|
| **Node.js 20+** | API Express + build client | `nvm` o pacchetto Node; non usare solo PHP del dominio |
| **PostgreSQL + PostGIS** | DB punti/mappa, Prisma | Estensione `postgis` obbligatoria (`CREATE EXTENSION postgis`) |
| **Redis** | Solo job in background (scadenza prenotazioni 24h, reset mezzanotte, badge aeroplanini) | **Opzionale alla prima installazione** — vedi sotto |
| **PM2** (consigliato) | Tenere l’API attiva | Fase 1: solo `libery-api`. Fase 2: aggiungi `libery-worker` quando c’è Redis |
| **Nginx** (Hestia) | HTTPS + static PWA + proxy `/api` | Template personalizzato sul dominio |
| **Cartella uploads** | Avatar e file persistenti | Fuori da `public_html`, es. `/home/admin/libery/uploads` |

## Variabili d'ambiente (`server/.env`)

Copia da `server/.env.example` e imposta in produzione:

```env
DATABASE_URL="postgresql://USER:PASS@127.0.0.1:5432/libery?schema=public"
# Redis — opzionale in fase 1 (commenta o lascia vuoto se non installato)
# REDIS_URL="redis://127.0.0.1:6379/2"
JWT_ACCESS_SECRET="..."      # stringa lunga casuale
JWT_REFRESH_SECRET="..."     # diversa dalla precedente
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"
PORT=3001
# Se 3001 è già usata da un altro progetto: PORT=3012 (e stessa porta in nginx)
NODE_ENV=production
CLIENT_URL="https://libery.foundly.it"
UPLOAD_DIR="/home/USER/libery/uploads"
# Postgres: credenziali DB «libery» create in Hestia (non riusare DB di altri siti)
ADMIN_EMAIL="admin@libery.app"
ADMIN_PASSWORD="..."
GOOGLE_BOOKS_API_KEY="..."   # consigliato per ISBN
SMTP_FROM="..."
SMTP_USER="..."
SMTP_PASS="..."              # password app Gmail
```

Non committare mai `server/.env` nel repository.

## Database PostgreSQL

**Preferito su Hestia:** pannello → **DB** → aggiungi database `libery` + utente dedicato (non riusare utente/DB di WordPress o altri progetti). Poi in `DATABASE_URL` incolla la stringa che Hestia mostra.

Estensioni (una tantum sul DB `libery`):

```bash
# sostituisci con utente/host del tuo Hestia
psql "postgresql://libery_user:PASS@127.0.0.1:5432/libery" -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql "postgresql://libery_user:PASS@127.0.0.1:5432/libery" -c "CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;"
```

Non serve un secondo server Postgres: un’istanza, **database separato**.

## Inventario server (prima del deploy)

Sul VPS, dopo il clone del repo:

```bash
cd /path/to/libery
bash deploy/inventory.sh
```

Incolla l’output in chat (senza password). Serve per scegliere porta API, DB e Redis senza conflitti.

---

## Fase 1 — Solo PostgreSQL (senza Redis)

Adatto al tuo caso: **Postgres sì**, notifiche/job differiti.

| Funziona senza Redis | Richiede Redis (dopo) |
|----------------------|------------------------|
| Login, mappa, punti, libri, scan, lascia/ritira | Scadenza automatica prenotazione dopo 24h |
| Notifiche in DB + polling client (QR, manager) | Job mezzanotte (reset slot) |
| Inventario manager, admin | Controllo badge «aeroplanini» in background |

Le **notifiche** (tabella `notification` in Postgres) **non usano Redis**: l’app le legge via API. Redis serve solo al processo `worker` per i timer.

```bash
# PM2 — solo API (non avviare libery-worker)
pm2 start deploy/ecosystem.api-only.cjs
pm2 save
```

Quando vorrai Redis: `apt install redis-server`, imposti `REDIS_URL` in `.env`, poi:

```bash
pm2 start deploy/ecosystem.config.cjs --only libery-worker
# oppure passi all’ecosystem completo con entrambi i processi
```

## Deploy (prima volta)

```bash
# 1. Clone (cartella dedicata, non dentro public_html di altri siti)
cd /home/admin
git clone git@github.com:TUO_USER/libery.git
cd libery
git checkout deploy/foundly-it   # o il branch che usi

# 2. Dipendenze e build
npm ci
npm run build -w server
npm run build -w client

# 3. Ambiente
cp server/.env.example server/.env
nano server/.env   # compila tutto

mkdir -p /home/admin/libery/uploads
npm run db:generate -w server
npm run db:migrate:deploy -w server
npm run seed:admin -w server   # solo prima installazione

# 4. Verifica conflitti (porta, PM2, Docker)
bash deploy/check-server.sh 3001

# 5. PM2 — solo API senza Redis (fase 1)
npm install -g pm2
pm2 start deploy/ecosystem.api-only.cjs
pm2 save
# Con Redis (fase 2): pm2 start deploy/ecosystem.config.cjs
# Se PM2 startup è già configurato per altri progetti, NON rilanciare setup globale senza leggere l’output
```

## Nginx (Hestia)

In Hestia: **Web → libery.foundly.it → Edit → Advanced** (o file in  
`/home/admin/conf/web/libery.foundly.it/nginx.ssl.conf`).

Usa come riferimento `deploy/nginx-libery.conf.example`:

- `root` → `.../libery/client/dist` (file statici Vite)
- `location /api` → proxy su `http://127.0.0.1:PORT` (stesso `PORT` di `server/.env`)
- `try_files` per SPA React (`/index.html`)

Poi: `nginx -t && systemctl reload nginx` (o rebuild dominio da Hestia).

## Aggiornamenti

```bash
cd /home/admin/libery
git pull
npm ci
npm run build -w server
npm run build -w client
npm run db:migrate:deploy -w server
pm2 restart libery-api libery-worker
```

## Verifica

```bash
curl -s https://libery.foundly.it/api/health | jq
```

Risposta attesa: `"ok": true`, `"database": "connected"`.

## SSH

Sì, tutto si fa in SSH (clone, build, migrate, PM2, log). Serve:

- IP/host del VPS e utente SSH (es. `admin`)
- Chiave SSH o password
- Permesso `sudo` per nginx/redis se necessario

L'agente in Cursor può preparare file e comandi; la sessione SSH sul **tuo** server la apri tu (o condividi host/utente in un secondo momento).
