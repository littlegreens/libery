# Deploy Libery su server IONOS + Hestia

Dominio provvisorio: **https://libery.foundly.it**

## Cosa serve sul server

| Componente | Perché | Note Hestia |
|------------|--------|-------------|
| **Node.js 20+** | API Express + build client | `nvm` o pacchetto Node; non usare solo PHP del dominio |
| **PostgreSQL + PostGIS** | DB punti/mappa, Prisma | Estensione `postgis` obbligatoria (`CREATE EXTENSION postgis`) |
| **Redis** | Code BullMQ (scadenze prenotazioni, job notturni) | Spesso non incluso in Hestia: `apt install redis-server` o container Docker |
| **PM2** (consigliato) | Tenere API + worker attivi | 2 processi: `libery-api`, `libery-worker` |
| **Nginx** (Hestia) | HTTPS + static PWA + proxy `/api` | Template personalizzato sul dominio |
| **Cartella uploads** | Avatar e file persistenti | Fuori da `public_html`, es. `/home/admin/libery/uploads` |

## Variabili d'ambiente (`server/.env`)

Copia da `server/.env.example` e imposta in produzione:

```env
DATABASE_URL="postgresql://USER:PASS@127.0.0.1:5432/libery?schema=public"
REDIS_URL="redis://127.0.0.1:6379"
JWT_ACCESS_SECRET="..."      # stringa lunga casuale
JWT_REFRESH_SECRET="..."     # diversa dalla precedente
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"
PORT=3001
NODE_ENV=production
CLIENT_URL="https://libery.foundly.it"
UPLOAD_DIR="/home/USER/libery/uploads"
ADMIN_EMAIL="admin@libery.app"
ADMIN_PASSWORD="..."
GOOGLE_BOOKS_API_KEY="..."   # consigliato per ISBN
SMTP_FROM="..."
SMTP_USER="..."
SMTP_PASS="..."              # password app Gmail
```

Non committare mai `server/.env` nel repository.

## Database PostgreSQL

Su Hestia puoi creare un DB dall'interfaccia o da CLI:

```bash
# come utente postgres o con credenziali Hestia
sudo -u postgres psql -c "CREATE USER libery WITH PASSWORD 'SCEGLI_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE libery OWNER libery;"
sudo -u postgres psql -d libery -c "CREATE EXTENSION IF NOT EXISTS postgis;"
sudo -u postgres psql -d libery -c "CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;"
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

# 4. PM2
npm install -g pm2
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # segui le istruzioni per avvio al boot
```

## Nginx (Hestia)

In Hestia: **Web → libery.foundly.it → Edit → Advanced** (o file in  
`/home/admin/conf/web/libery.foundly.it/nginx.ssl.conf`).

Usa come riferimento `deploy/nginx-libery.conf.example`:

- `root` → `.../libery/client/dist` (file statici Vite)
- `location /api` → proxy su `http://127.0.0.1:3001`
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
pm2 restart all
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
