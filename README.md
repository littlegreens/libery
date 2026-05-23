# Libery

PWA di bookcrossing geolocalizzato — **cerca, scambia, leggi**.

Documentazione tecnica completa: [BRAIN.md](./BRAIN.md)

## Requisiti

- Node.js 20+
- Docker Desktop

## Avvio rapido (Windows)

```powershell
# 1. Database e Redis
docker compose up -d

# 2. Dipendenze root (workspaces)
npm install

# 3. Config server
copy server\.env.example server\.env

# 4. Migrazioni Prisma
npm run db:migrate

# 5. Avvia client + API insieme
npm run dev
```

- **App:** http://localhost:5173  
- **API:** http://localhost:3001/api/health  
- **Postgres:** `localhost:5433` — db `libery`, user `libery`, password `libery_dev`  
- **Redis:** `localhost:6379`

## Comandi utili

| Comando | Descrizione |
|---------|-------------|
| `npm run docker:up` | Avvia Postgres + Redis |
| `npm run docker:down` | Ferma i container |
| `npm run dev` | Client + server in parallelo |
| `npm run db:studio` | Prisma Studio |

## Deploy produzione (Hestia / VPS)

Guida passo-passo: [docs/DEPLOY-HESTIA.md](./docs/DEPLOY-HESTIA.md)  
Esempi PM2 e Nginx: cartella `deploy/`.

## Struttura

```
libery/
├── BRAIN.md          # Specifica prodotto/tecnica
├── client/           # React + Vite + Bootstrap
├── server/           # Express + Prisma
├── deploy/           # PM2 + nginx esempio
└── docker-compose.yml
```
