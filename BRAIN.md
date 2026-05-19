# LIBERY — BRAIN DOCUMENT v3
> Documento tecnico di riferimento per lo sviluppo con Cursor AI.
> v3 integra: sistema **Libri** (slot per prendere), **Aeroplanini** (badge/achievement), responsabile = utente, QR stateless a stringa, notifiche real-time via polling, flussi completi Prendi/Lascia per Punti Certificati e Corner Free.

---

## 1. OVERVIEW DEL PROGETTO

**Libery** è una PWA di bookcrossing digitale che connette biblioteche, librerie e corner free in una rete di scambio libri geolocalizzata. Chiunque può trovare un libro vicino a sé, prenderlo, e rimettere in circolo quello che ha già letto.

**Tagline:** cerca, scambia, leggi
**Nome app:** Libery
**Tipo:** PWA (Progressive Web App) — impacchettabile per store iOS/Android con Capacitor
**Repository:** monorepo con `/client` e `/server`

---

## 2. STACK TECNOLOGICO

### Frontend
- **Framework:** React + Vite
- **Styling:** **Bootstrap** come base + foglio di customizzazioni CSS ad hoc (tema Libery, palette, tipografia, componenti badge passaporto / Aeroplanini)
- **Mappe:** Leaflet + React-Leaflet
- **State management:** Zustand
- **HTTP client:** Axios
- **Scanner:** libreria robusta per QR code e barcode ISBN (es. `zxing-js/browser` o equivalente con buon supporto iOS/Android in-browser)
- **PWA:** Vite PWA Plugin (service worker, manifest, offline cache)
- **Pacchettizzazione store:** Capacitor (post-MVP)

### Backend
- **Runtime:** Node.js
- **Framework:** Express
- **ORM:** Prisma
- **Database:** PostgreSQL + PostGIS (per geolocalizzazione punti)
- **Auth:** JWT (access token + refresh token)
- **Email:** Nodemailer (SMTP) per notifiche e approvazioni
- **Job queue:** BullMQ (job asincroni: ricerca ISBN, scadenza prenotazioni, **reset slot Libri di mezzanotte**, notifiche)
- **Storage immagini:** cartella su VPS IONOS/HestiaCP con path strutturato `/covers/[anno]/[mese]/[isbn].jpg`
- **Cache:** Redis (cache ISBN già risolti, code BullMQ)

### Infrastruttura
- **Sviluppo locale:** Docker Compose (PostgreSQL + PostGIS, Redis)
- **Produzione:** VPS IONOS + HestiaCP
- **Reverse proxy:** Nginx
- **Process manager:** PM2
- **SSL:** Let's Encrypt

---

## 3. RUOLI UTENTE

### 3.1 Utente (Cittadino)
- Registrazione con email + password
- Cerca libri sulla mappa o per titolo/autore/ISBN
- Prende e lascia libri nei punti
- Prenota libri nei Punti Certificati (24h) — solo biblioteca e libreria
- Segnala libri mancanti o presenti nei Corner Free
- **Zaino** con sezioni: *Presi*, *Prenotati*, *Donati*
- **Contatore Libri** (slot per prendere) — vedi §6
- **Aeroplanini** (badge per achievement) — vedi §7

### 3.2 Responsabile Punto (Biblioteca / Libreria / Corner Free)
**Il responsabile NON ha un'app separata.** È un utente normale con:
- Zaino, slot Libri, Aeroplanini, profilo identici a un utente standard
- In più: ruolo `point_manager` e accesso alla sezione **"Il mio punto"** nel menu

Funzionalità aggiuntive nella sezione **"Il mio punto"**:
- Pulsante **SCAN** grande e centrale per inquadrare il QR utente e completare azioni Prendi/Lascia
- Pannello gestione punto: inventario, prenotazioni attive, statistiche
- Modifica info punto: nome, descrizione, orari, foto
- Geolocalizzazione punto: indirizzo → geocoding, oppure pin trascinabile su mappa
- Download QR punto in pagina A5 ottimizzata per stampa su forex/plexiglass
- **Solo librerie:** modifica cover e descrizione di un libro nel DB Libery se presente nel proprio inventario

Il flusso "Completa il tuo profilo" rimane obbligatorio al primo accesso (§10).

### 3.3 Admin (Team Libery)
- Pannello web separato (non PWA)
- Approva o rifiuta richieste nuovo Punto
- Sospende utenti o punti
- Fix manuali sul database libri
- Statistiche globali della rete

---

## 4. TIPOLOGIE DI PUNTO

| Tipo | Prenotazione | Validazione lascia | Inventario | Fee |
|---|---|---|---|---|
| **Biblioteca** | ✅ 24h | Conferma addetto (scan QR utente) | Affidabile | Sì (fuori app) |
| **Libreria** | ✅ 24h | Conferma addetto (scan QR utente) | Affidabile | Sì (fuori app) |
| **Corner Free** | ❌ No | Immediato | Crowdsourced | No |

**Note importanti:**
- Biblioteca e Libreria hanno **identica logica applicativa**. La distinzione è solo nel campo `type` e nella fee (gestita completamente fuori dall'app).
- Il Corner Free ha sempre un gestore registrato ma l'inventario è gestito dagli utenti tramite segnalazioni.
- **Non esiste più una coda separata `pending_copies`**: nei Punti Certificati la validazione è il fatto stesso che l'addetto ha il libro in mano e preme **"Ricevuto"** nello scan QR. Il libro è disponibile immediatamente da quel momento.

---

## 5. SCHEMA DATABASE (PostgreSQL)

### users
```sql
id              UUID PRIMARY KEY
email           VARCHAR UNIQUE NOT NULL
password_hash   VARCHAR NOT NULL
display_name    VARCHAR
avatar_url      VARCHAR
libri_extra     INTEGER DEFAULT 0   -- slot permanenti accumulati con le donazioni
libri_oggi_used INTEGER DEFAULT 0   -- slot del giorno consumati (reset mezzanotte)
role            ENUM('user', 'point_manager', 'admin')
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**Slot Libri (riepilogo):**
```
libri_oggi   = max(0, 1 - libri_oggi_used)     -- 1 slot al giorno, non si cumula
libri_extra  = donazioni storiche dell'utente   -- permanenti, si accumulano
libri_totali = libri_oggi + libri_extra
```

### user_aeroplanini (achievement)
```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users(id)
type        VARCHAR              -- es. 'primo_volo', 'esploratore'
earned_at   TIMESTAMP
UNIQUE(user_id, type)
```

### points
```sql
id              UUID PRIMARY KEY
name            VARCHAR NOT NULL
type            ENUM('biblioteca', 'libreria', 'corner_free')
status          ENUM('pending', 'approved', 'suspended')
setup_completed BOOLEAN DEFAULT false
manager_id      UUID REFERENCES users(id)
address         VARCHAR
city            VARCHAR
location        GEOGRAPHY(POINT, 4326)
description     TEXT
opening_hours   JSONB
photo_url       VARCHAR
qr_token        VARCHAR UNIQUE     -- usato per QR cartello/espositore
created_at      TIMESTAMP
approved_at     TIMESTAMP
approved_by     UUID REFERENCES users(id)
```

### books
```sql
id              UUID PRIMARY KEY
isbn            VARCHAR(13) UNIQUE NOT NULL
title           VARCHAR NOT NULL
author          VARCHAR
publisher       VARCHAR
year            INTEGER
edition         VARCHAR
description     TEXT
cover_path      VARCHAR           -- locale: /covers/[anno]/[mese]/[isbn].jpg
language        VARCHAR
pages           INTEGER
genre           VARCHAR
source          ENUM('libery_db', 'google_books', 'open_library')
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### point_books (inventario, **senza pending_copies**)
```sql
id              UUID PRIMARY KEY
point_id        UUID REFERENCES points(id)
book_id         UUID REFERENCES books(id)
copies          INTEGER DEFAULT 0     -- copie disponibili confermate
status          ENUM('active', 'removed')
first_added_at  TIMESTAMP
last_updated_at TIMESTAMP
UNIQUE(point_id, book_id)
```

### reservations (solo punti certificati)
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
point_book_id   UUID REFERENCES point_books(id)
status          ENUM('active', 'completed', 'expired', 'cancelled')
expires_at      TIMESTAMP            -- +24h dalla prenotazione
created_at      TIMESTAMP
```

### transactions (statistiche, no copia fisica)
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)   -- NULL se libro consegnato senza QR
point_id        UUID REFERENCES points(id)
book_id         UUID REFERENCES books(id)
type            ENUM('take', 'leave')
created_at      TIMESTAMP
```

### reports (segnalazioni corner free)
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
point_book_id   UUID REFERENCES point_books(id)
type            ENUM('missing', 'present')
created_at      TIMESTAMP
```

### notifications (per polling real-time)
```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users(id)
type        VARCHAR        -- es. 'take_completed', 'leave_completed', 'reservation_expired_at_scan'
title       VARCHAR
body        TEXT
data        JSONB          -- es. { bookId, pointId, transactionId }
read_at     TIMESTAMP NULL
created_at  TIMESTAMP
```

### point_requests
Invariato rispetto a v2.

---

## 6. SISTEMA LIBRI — SLOT PER PRENDERE

### Logica
Ogni utente ha un contatore **Libri** 📚 che determina quanti libri può prendere in un dato momento.

```
libri_oggi    = 1 (reset a mezzanotte locale; non si cumula)
libri_extra   = totale libri donati nella storia dell'utente (permanente)
libri_totali  = libri_oggi + libri_extra
```

**Consumo:**
- Ogni azione **"Prendi"** consuma 1 slot da `libri_totali`
- L'ordine è: prima `libri_oggi`, poi `libri_extra`
- Se `libri_totali = 0` → l'utente non può prendere fino al giorno successivo
- Gli slot extra non scadono mai

**Accumulo:**
- Ogni libro **lasciato** confermato → `libri_extra + 1`

**Job BullMQ:** `midnight-reset`
```
Ogni mezzanotte (timezone Europe/Rome):
UPDATE users SET libri_oggi_used = 0;
```

**Visualizzazione:**
- Home dashboard: `Oggi puoi prendere N libri  📚 × N` con `N = libri_totali`
- Aggiornamento immediato lato client dopo conferma notifica Prendi/Lascia
- Pulsante "Prendi" disabilitato se `libri_totali = 0`

---

## 7. SISTEMA AEROPLANINI — BADGE / ACHIEVEMENT

Separato dal sistema Libri. Puramente estetico nella v1.

### Achievement v1 (espandibili)

| Codice | Nome | Condizione |
|---|---|---|
| `primo_volo` | Primo Volo | Hai lasciato il tuo primo libro |
| `esploratore` | Esploratore | Hai visitato 5 punti diversi |
| `custode` | Custode | Hai segnalato 10 libri mancanti |
| `grande_donatore` | Grande Donatore | Hai lasciato 10 libri |
| `viaggiatore` | Viaggiatore | Hai lasciato libri in 3 città diverse |

### Logica sblocco
Hook post-azione → query controllo soglie → se condizione superata e badge assente → `INSERT user_aeroplanini`.

Aeroplanini visibili nel profilo. Quello "in evidenza" è il più recente; sotto lista completa + progress bar verso il prossimo.

---

## 8. SISTEMA QR CODE

### 8.1 QR Cartello / Espositore (statico per punto)
- Formato: `https://libery.app/punto/[qr_token]`
- Stampabile in A5 ad alta risoluzione (pagina dedicata `/manager/qr/print`)
- Identifica il punto (biblioteca, libreria, corner_free)

### 8.2 QR Utente (generato a runtime, **stateless, no TTL**)

L'utente genera il QR quando è pronto, lo mostra all'addetto, può chiuderlo e rigenerarlo all'infinito.

**Formato stringa:**
```
[AZIONE],[ISBN],[user_id]
```

| Campo | Valori | Esempio |
|---|---|---|
| AZIONE | `L` = lascia, `P` = prendi | `L` |
| ISBN | ISBN-13 del libro | `9788807123456` |
| user_id | ID utente loggato | `usr_abc123` |

**Esempi:**
```
L,9788807123456,usr_abc123   → utente vuole lasciare quel libro
P,9788807123456,usr_abc123   → utente vuole prendere quel libro
```

- Capacità QR ≪ 60 caratteri, nessun problema di spazio
- Server non deve validare scadenze, solo controllare lo stato del libro/prenotazione al momento dello scan addetto

---

## 9. CAMERA — UNA SOLA, COMPORTAMENTO CONTESTUALE

**Niente modalità manuali.** L'utente apre la camera (FAB "Inquadra" o pulsanti specifici) e l'app riconosce automaticamente cosa viene inquadrato.

| Inquadro | Cosa fa l'app |
|---|---|
| **Barcode libro (ISBN)** | Cascata ISBN, censimento DB se nuovo, mostra **card riepilogo** col bottone "Lascia" (§13) |
| **QR cartello punto** (Punto Certificato o Corner Free) | Apre la **scheda del posto** con la lista libri |
| **QR utente** `L\|P,ISBN,user_id` | Solo se chi inquadra è un addetto loggato (sezione "Il mio punto") |

L'overlay grafico è unico (mirino generico), la app sceglie cosa fare in base al contenuto letto.

**Fallback ISBN illeggibile:** ovunque serva scansionare un libro c'è un bottone secondario *"Inserisci ISBN manualmente"* + ricerca testuale per titolo/autore nel catalogo Libery.

---

## 10. NOTIFICHE IN TEMPO REALE

### Strategia di polling — mirata, non globale
Il polling esiste **solo nelle finestre di attesa di un'azione**. Appena la schermata si chiude o la notifica arriva, il polling si ferma. Niente polling di sottofondo, niente long-polling generico.

| Contesto | Polling | Frequenza |
|---|---|---|
| Schermata QR utente aperta (in attesa "Ricevuto"/"Consegnato") | ✅ | 2 s primi 30 s → 5 s dopo |
| Schermata SCAN responsabile (anteprima azione, in attesa conferma) | ✅ | 2 s |
| Home dashboard | ❌ (solo 1 fetch all'apertura + pull-to-refresh) | — |
| Resto dell'app | ❌ | — |

Implementazione client: hook `useNotificationPolling({ enabled, intervalMs })` con backoff e cleanup automatico su `unmount`.

WebSocket valutabile in seguito se serve maggiore reattività o se l'audience cresce.

### Endpoint
```
GET    /api/notifications?since=<timestamp>   -- nuove notifiche per l'utente loggato
POST   /api/notifications/:id/read            -- marca come letta
```

### Trigger

| Evento | Chi riceve | Messaggio |
|---|---|---|
| Addetto preme "Ricevuto" (lascia) | Utente che ha lasciato | *"Hai lasciato [Titolo]. Grazie, è ora parte della rete Libery."* |
| Addetto preme "Consegnato" (prendi) | Utente che ha preso | *"Hai preso [Titolo]. Buona lettura!"* |
| Prenotazione scaduta al momento scan | Addetto | *"Prenotazione scaduta. Il libro non è più riservato a questo utente."* |

### Comportamento UI alla notifica
- Animazione di conferma a schermo
- Aggiornamento visivo immediato: slot Libri, zaino, libri_extra, Aeroplanini sbloccati
- Pulsante per tornare alla home

---

## 11. FLUSSI COMPLETI

### Principio di base
> **Se ho scansionato un libro, ce l'ho in mano. Posso solo Lasciarlo.**
> **Se voglio Prendere un libro, parto dal posto** (la lista digitale del posto è la sorgente, mai il libro fisico).

### 11.1 Apertura app

```
App aperta
│
├── Non loggato → Home con logo, tagline, pulsante "Entra"
│
└── Loggato → Home dashboard (§13):
              · slot Libri del giorno
              · Zaino rapido (Presi, Prenotati, Donati)
              · Aeroplanini in evidenza + progress
              · Mini mappa + shortcut Cerca / Inquadra
```

---

### 11.2 SCANSIONE LIBRO → card riepilogo

L'utente apre la camera e inquadra il **barcode di un libro**. Il libro è considerato in suo possesso.

**Card riepilogo (compatta, sopra al viewfinder):**
```
┌─────────────────────────────┐
│ [cover]  Titolo              │
│          Autore — 2023       │
│  [ Vai alla scheda → ]       │
│                              │
│  [        Lascia        ]    │
└─────────────────────────────┘
```

- L'app esegue la cascata ISBN (§15) e, se nuovo, censisce il libro nel DB Libery
- Stato libro: **neutro**, non in nessuno zaino, non in nessun posto
- L'unico bottone azione è **Lascia** → §11.3
- **"Vai alla scheda"** apre la scheda libro completa (§13): solo informazioni, **nessun bottone azione**. Back ripristina la card riepilogo col bottone Lascia.

---

### 11.3 AZIONE **LASCIA**

Parte dalla card riepilogo (post scansione) o dallo Zaino su un libro Preso che l'utente vuole rimettere in circolo.

```
Premo "Lascia"
   │
   └── App genera QR  L,ISBN,user_id   (DEFAULT = consegna in Punto Certificato)
        │
        └── Sotto al QR: bottone "Sono a un Corner Free?"
              │
              ├── GPS attivo → "Sei al Corner X di Via Y?" → Sì → "Lascia il libro" ✅
              ├── GPS spento → "Trova il tuo Corner" (mappa + ricerca testuale) → seleziono → conferma ✅
              └── "Inquadra il QR del Corner" → identifica corner → conferma ✅
```

#### Esito Punto Certificato (QR rimasto in attesa)
1. Utente mostra QR all'addetto
2. Addetto col SCAN inquadra il QR
3. Riceve fisicamente il libro → **"Ricevuto"**
4. Sistema: `copies + 1`, `transaction leave`, `libri_extra + 1`, hook Aeroplanini
5. **Notifica utente:** *"Hai lasciato [Titolo]. Grazie, è ora parte della rete Libery."* → Zaino > Donati

#### Esito Corner Free (utente conferma in app)
1. Utente preme **"Lascia il libro"** dopo aver identificato il corner
2. Sistema: `copies + 1`, `transaction leave`, `libri_extra + 1`, hook Aeroplanini
3. **Notifica:** *"Hai lasciato [Titolo]. È ora disponibile in questo corner."* → Zaino > Donati

---

### 11.4 AZIONE **PRENDI** — sempre dal posto

Non parte mai dalla scansione di un libro. Si arriva al posto in 3 modi:

| Aggancio posto | Come |
|---|---|
| **QR cartello** | Inquadro il QR del cartello/espositore del posto |
| **GPS** | Banner "Sei al Corner X / Biblioteca Y?" → conferma con tap |
| **Manuale** | Mappa o ricerca → tap su un pin/voce |

Dentro la scheda del posto vedo la lista libri, tap su un titolo → **Prendi**.

#### Punto Certificato
1. App genera QR `P,ISBN,user_id`
2. Utente mostra all'addetto, che ha già il libro custodito dietro al bancone
3. Addetto col SCAN inquadra
4. App addetto mostra: cover, titolo, nome utente, badge "Prenotazione attiva ✓" se presente
5. **Controlli server al momento dello scan:**
   - `copies > 0` (Prendi diretto) **oppure** prenotazione attiva valida di quell'utente
   - Prenotazione attiva di **altro** utente sul libro → blocca
   - `libri_totali = 0` per quell'utente → blocca
6. Addetto preleva fisicamente il libro → **"Consegnato"**
7. Sistema: `copies -1` (se prendi diretto) / invariato (se prenotazione), `transaction take`, `libri_oggi_used +1` (poi `libri_extra -1`)
8. **Notifica:** *"Hai preso [Titolo]. Buona lettura!"* → Zaino > Presi

#### Corner Free (no controllo umano)
1. Utente sceglie libro dalla lista del corner → **Prendi** → conferma
2. Sistema: `copies -1`, `transaction take`, slot Libri -1
3. **Notifica:** *"Hai preso [Titolo]. Buona lettura!"* → Zaino > Presi
4. **Race condition:** check transazionale; il primo prende, gli altri ricevono *"Libro non più disponibile"*

#### Caso libro fisicamente al corner ma NON in lista
L'utente lo prende fisicamente e basta — Libery non se ne occupa in quel momento. Quando l'utente lo cederà altrove (un altro Corner o un Punto Certificato), partirà il flusso Lascia e il libro rientrerà nel circuito.

#### Caso libro in lista ma fisicamente assente
Nella scheda del corner, accanto a ogni libro: bottone **"Non c'è più"** → conferma → `copies = 0`, `report missing`. Una sola segnalazione basta. Nessuna penalità.

---

### 11.5 PRENOTAZIONE — solo Punti Certificati

```
Da casa: mappa/ricerca → libro disponibile in Certificato → "Prenota"
  → copies -1, reservation 24h, libro in Zaino arancione + countdown

In biblioteca entro 24h: Zaino → tap libro prenotato → "Prendi"
  → QR P,ISBN,user_id → addetto → "Consegnato"
  → libro diventa Attivo (Zaino > Presi)
```

Se scade senza ritiro: `copies +1`, `reservation expired`, libro torna disponibile, libro tolto dallo Zaino Prenotati.

---

### 11.6 ADDETTO — sezione "Il mio punto" → SCAN

Una sola operazione operativa: pulsante **SCAN** grande, centrale.

| QR letto | Cosa mostra | Bottone |
|---|---|---|
| `L,ISBN,user_id` | cover, titolo, nome utente | **"Ricevuto"** → `copies +1`, notifica utente |
| `P,ISBN,user_id` | cover, titolo, utente, badge prenotazione (se attiva) | **"Consegnato"** → `copies -1` (se prendi diretto), notifica utente |
| QR cartello / ISBN / altro | errore amichevole *"Inquadra il QR generato dall'utente"* | — |

**Correzioni a posteriori** (inventario del proprio punto):
- *"Libro consegnato senza scan"* (l'addetto ha dato il libro senza che l'utente passasse per il QR): `-1 copia` dall'inventario, nessuna `transaction.user_id` legata, libro non assegnato a un utente specifico
- *"Libro non più presente"* (perso/danneggiato): `-1 copia` o `Rimuovi tutto`

---

### 11.7 Setup iniziale Punto — "Completa il tuo profilo"

Flusso obbligatorio al **primo accesso** del responsabile, prima della sezione "Il mio punto".

| Campo | Comportamento |
|---|---|
| Nome punto | Precompilato da approvazione, modificabile |
| Descrizione | Testo libero |
| Indirizzo | Input → **geocoding automatico** (Nominatim) → aggiorna `location` |
| Posizione mappa | **Pin trascinabile** Leaflet; sposta = aggiorna coordinate ed eventuale reverse-geocoding |
| Orari | Editor `opening_hours` (JSONB) |
| Foto punto | Upload → VPS, `photo_url` |

Al salvataggio:
- `setup_completed = true`
- Punto visibile in mappa pubblica
- Banner: "Scarica il tuo QR per l'espositore"

---

## 12. RUOLO RESPONSABILE — Utente + sezione "Il mio punto"

Il responsabile usa la **stessa app** dell'utente. Il menu in più contiene la sezione **"Il mio punto"** disponibile solo se `users.role = 'point_manager'`.

### Schermata principale "Il mio punto"
- Pulsante **SCAN** grande, centrale, sempre visibile → apre fotocamera in QR Mode per inquadrare il QR utente
- Sotto: prenotazioni attive oggi (con countdown), statistiche rapide (transiti settimana, libri attivi)

### Schermata Scan QR utente
Dopo lo scan del QR `L,ISBN,user_id` o `P,ISBN,user_id`:
- Mostra cover, titolo, autore, nome utente, badge prenotazione attiva o no
- Effettua **controlli server** (slot, prenotazioni, copies)
- Pulsante **"Ricevuto"** (per L) o **"Consegnato"** (per P)
- Su conferma: registra l'azione, invia notifica all'utente, aggiorna inventario

### Altri pannelli "Il mio punto"
- **Inventario completo:** numero copie per libro; azioni `-1 copia` (persa/danneggiata), `Rimuovi tutto`
- **Modifica info punto:** nome, descrizione, orari, foto
- **Geolocalizzazione:** indirizzo + pin trascinabile
- **Stampa QR punto:** PNG / pagina A5 con margini esatti, ottimizzata forex/plexiglass
- **Statistiche estese:** transiti nel tempo, titoli più richiesti, utenti unici
- **Solo Librerie:** modifica cover e descrizione di libri presenti nel proprio inventario

---

## 13. DASHBOARD UTENTE & SCHEDA LIBRO

### Home dashboard

**Sezione superiore — slot del giorno:**
```
Oggi puoi prendere N libri   📚 × N
```
con `N = libri_oggi + libri_extra`. Se `N = 0`: messaggio *"Hai esaurito i libri di oggi. Torna domani o dona un libro per averne uno extra."*

**Sezione Zaino rapido:**
- Presi: lista orizzontale scrollabile con cover
- Prenotazioni attive: countdown 24h in evidenza
- Ultimi donati: cover piccole

**Sezione Aeroplanini:**
- Badge guadagnati in evidenza (il più recente in primo piano)
- Prossimo badge da sbloccare con progress bar

**Sezione mappa rapida:**
- Mini mappa con punti vicini
- Shortcut **"Inquadra"** (apre camera) e **"Cerca un libro"**

### Scheda libro completa

Si raggiunge da:
- Tap **"Vai alla scheda"** sulla card riepilogo post-scansione
- Tap su un libro da una lista (ricerca, scheda posto, zaino)

**Contenuto (solo informativo, niente bottoni azione):**
- Cover grande, titolo, autore, anno, editore
- Trama completa
- Genere, lingua, pagine
- Sezione **"Dove è presente"**: lista posti con copie disponibili, **ordinata per vicinanza** se GPS attivo
  - Tap su un posto → scheda del posto
- ISBN, dati edizione

I bottoni **Lascia / Prendi** non sono mai qui. Solo nei contesti pertinenti (card riepilogo, scheda posto, scheda libro dallo zaino).

### Stati del libro per l'utente

| Stato | Quando | Visivo |
|---|---|---|
| **Neutro** | Dopo scansione, non agganciato | Card riepilogo, non in Zaino |
| **Prenotato** | Prenotazione attiva su Certificato | Zaino, arancione + countdown 24h |
| **In attesa addetto** | QR `L\|P` aperto, in polling | Stato temporaneo, no zaino |
| **Preso** | Conferma addetto / Prendi Corner | Zaino > Presi |
| **Donato** | Conferma addetto / Lascia Corner | Zaino > Donati (storico) |

---

## 14. SCHEDA PUNTO

### Tutti i tipi
- Info, foto, orari, mappa
- Lista libri disponibili (filtrabile)
- Pulsanti principali: **"Prendi"** / **"Lascia"** (Corner Free) o **"Prenota"** / **"Prendi ora"** / **"Lascia"** (Punto Certificato)

### Solo Corner Free — Tab "Passati di qui"
- Lista cronologica di **tutti i libri transitati** in quel corner (anche non più disponibili)
- Mostra: cover, titolo, data transito
- Query su `transactions` filtrata per `point_id`
- Dà identità e storia al luogo

---

## 15. CASCATA ISBN

```
1. DB Libery interno    → SELECT * FROM books WHERE isbn = ?   (€0, priorità massima)
2. Google Books API     → volumes?q=isbn:[isbn]                (volumes gratuito alto)
```

Il DB interno cresce ad ogni scansione. Nel tempo diventa la fonte primaria.

### Cover

**Google Books resta la fonte primaria** — ha la copertura migliore sul catalogo italiano (Einaudi, Adelphi, Mondadori…) e generalmente qualità immagine superiore. Open Library è il fallback, non il default.

- Scaricata e salvata localmente: `/covers/[anno]/[mese]/[isbn].jpg`
- **Cascata cover:**
  1. URL cover da Google Books → download su VPS
  2. Se fallisce (403, timeout, **placeholder Google riconosciuto**) → fallback Open Library: `https://covers.openlibrary.org/b/isbn/[isbn]-L.jpg` → download su VPS
  3. Se anche questo fallisce → `cover_path = NULL`, UI placeholder generico

**Riconoscimento placeholder Google — tre check combinati (no falsi positivi):**
1. URL con `zoom=0` (parametro che non usiamo più, viene da edizioni mal generate)
2. Dimensioni esatte **575×750**
3. MD5 = `a64fa89d7ebc97075c1d363fc5fea71f` (hash bit-per-bit del PNG generico Google)

Se anche solo uno non combacia, l'immagine si considera valida. Una vera copertina non può collidere bit-per-bit col placeholder.

### Note implementative (in vigore)
- Niente più `zoom=0` per URL Google (restituisce spesso il placeholder "image not available")
- Il GET dettaglio volume Google viene usato per ottenere la `description` (la ricerca per ISBN non la include)
- Merge metadati: preferenza alla lingua del libro per la trama

---

## 16. LOGICA COPIE — Riepilogo definitivo

```
point_books.copies = copie fisicamente disponibili e confermate
```

Non esiste tracciamento della singola copia fisica. L'ISBN identifica l'opera/edizione. Due libri stesso ISBN nello stesso punto = `copies: 2`.

| Evento | Effetto |
|---|---|
| Utente lascia (Corner Free) | `copies + 1` immediato |
| Utente lascia (Punto Certificato — Ricevuto addetto) | `copies + 1` immediato |
| Utente prende | `copies - 1` |
| Utente prenota (Certificato) | `copies - 1` (riservata) |
| Prenotazione scade/cancellata | `copies + 1` |
| Responsabile rimuove N copie | `copies - N` |
| Segnalazione mancante (Corner Free) | `copies = 0` |
| `copies = 0` | libro non visibile in lista pubblica (resta in DB per storico) |

Le `transactions` sono eventi statistici (chi, cosa, dove, quando), non oggetti fisici.

**Il libro dopo il "Prendi" è dell'utente.** Bookcrossing, non prestito. Nessuna restituzione. Chi dona accumula `libri_extra`. Chi prende usa uno slot.

---

## 17. JOB ASINCRONI (BullMQ)

| Job | Trigger | Azione |
|---|---|---|
| `isbn-resolve` | Nuovo ISBN | Cascata + salva + cover |
| `cover-download` | ISBN con cover URL | Scarica su VPS, fallback Open Library |
| `reservation-expire` | Creazione prenotazione | Job ritardato a `expires_at`; segna expired, ripristina `copies` |
| `email-send` | Vari | Coda SMTP |
| `midnight-reset` | Cron giornaliero (00:00 Europe/Rome) | `UPDATE users SET libri_oggi_used = 0` |
| `aeroplanini-check` | Hook post-azione (lascia, take, report) | Verifica condizioni achievement, inserisce `user_aeroplanini` |

---

## 18. API ENDPOINTS (REST)

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/verify-email
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
```

### Utente
```
GET    /api/user/profile             -- include libri_oggi, libri_extra, libri_totali, aeroplanini
GET    /api/user/aeroplanini
GET    /api/user/backpack            -- presi, prenotati, donati
GET    /api/notifications?since=
POST   /api/notifications/:id/read
```

### Punti
```
GET    /api/points
GET    /api/points/:id
GET    /api/points/:id/books
GET    /api/points/:id/history       -- Corner Free: "Passati di qui"
GET    /api/points/qr/:token         -- ingresso da QR cartello
POST   /api/points/request
GET    /api/points/nearby?lat=&lng=  -- corner free entro 30-50m (gps-based)
```

### Libri / Transazioni
```
GET    /api/books/isbn/:isbn
POST   /api/books/import
POST   /api/books/take               -- Corner Free Prendi diretto (no QR addetto)
POST   /api/books/leave              -- Corner Free Lascia diretto (no QR addetto)
POST   /api/reservations             -- Certificato Prenota
DELETE /api/reservations/:id         -- annulla
POST   /api/reports                  -- segnalazione missing / present
```

### Sezione "Il mio punto" (point_manager)
```
GET    /api/manager/point
PUT    /api/manager/point
PUT    /api/manager/point/setup
POST   /api/manager/point/photo
GET    /api/manager/point/geocode?q=
GET    /api/manager/qr               -- dati QR (token, URL)
GET    /api/manager/inventory
DELETE /api/manager/inventory/:book_id
GET    /api/manager/stats
PUT    /api/manager/book/:id         -- solo librerie
POST   /api/manager/scan             -- payload: { qr: "L,ISBN,user_id" | "P,ISBN,user_id" } → anteprima + check
POST   /api/manager/scan/confirm     -- payload: { action, isbn, userId } → applica Ricevuto/Consegnato
```

### Admin
Come in v2.

---

## 19. SCHERMATE APP

### Utente
| Schermata | Contenuto |
|---|---|
| **Home (dashboard)** | Slot Libri, zaino rapido, Aeroplanini, mini mappa, shortcut |
| **Mappa** | Pin per tipo punto; ricerca libro filtra mappa |
| **Scheda Punto** | Info, lista libri, azioni; Corner Free → tab "Passati di qui" |
| **Scanner QR** | UI quadrata, "Inquadra il cartello Libery" |
| **Scanner ISBN** | UI barcode, "Inquadra il codice sul retro del libro" |
| **Scheda Libro** | Cover, dati, disponibilità per punto |
| **Schermata QR utente** | QR stringa `L,…` o `P,…`; polling notifiche; chiudibile |
| **Zaino** | Tab Presi / Prenotati / Donati |
| **Profilo** | Avatar, display name, Libri, Aeroplanini, storico |
| **Onboarding** | 4 slide |

### Responsabile (`role = point_manager`) — sezione "Il mio punto"
| Schermata | Contenuto |
|---|---|
| **Completa il tuo profilo** | Setup obbligatorio (§11.7) |
| **Il mio punto (home)** | Pulsante SCAN gigante, prenotazioni oggi, stats rapide |
| **Scan QR utente** | QR Mode + scheda azione (cover, utente, conferma) |
| **Inventario** | Copie, rimozione |
| **Info Punto** | Modifica dati, geocoding, pin mappa |
| **Stampa QR** | Pagina A5 forex/plexiglass |
| **Statistiche** | Grafici impatto |

### Admin
Come in v2.

---

## 20. NOTE ARCHITETTURALI

- **Fee biblioteca e libreria:** fuori dall'app
- **Privacy:** geolocalizzazione utente solo client-side; chiamata `/points/nearby` solo su esplicito consenso del singolo gesto
- **Deep linking PWA:** URL scheme + manifest; iOS affidabile con Capacitor
- **Scanner:** due modalità UI distinte (QR vs ISBN), mai scelta manuale dell'utente
- **Nessun pagamento in app v1**
- **Il libro preso è dell'utente** — nessun tracking post-take
- **QR utente stateless:** server non firma né scade, valida solo lo stato al momento dello scan addetto
- **Bootstrap + CSS custom:** niente Tailwind; usare classi di Bootstrap come base + foglio `main.scss` per il tema

---

## 21. ORDINE DI SVILUPPO CONSIGLIATO (v3)

### Fase A — Adattamento schema & utente
1. Migrazione Prisma: rimuovi `users.timbri`, `user_badges`, `point_books.pending_copies`; aggiungi `users.libri_extra`, `users.libri_oggi_used`, `user_aeroplanini`, `notifications`; campo `transactions.user_id` nullable
2. Endpoint `/api/user/profile` con slot Libri + Aeroplanini
3. Reset mezzanotte (BullMQ cron)

### Fase B — QR utente + Scan responsabile
4. Componente client genera QR stringa `L|P,ISBN,user_id` con libreria QR
5. Schermata QR utente con polling notifiche
6. Sezione "Il mio punto" e pulsante SCAN
7. Endpoint `/api/manager/scan` (anteprima) e `/api/manager/scan/confirm`
8. Notifiche: tabella + endpoint polling + emissione su conferma azione

### Fase C — Flussi rifatti
9. Prendi/Lascia in Punto Certificato (con QR utente)
10. Prendi/Lascia in Corner Free (no QR utente; conferma ISBN per Prendi)
11. Identificazione corner via GPS (`/points/nearby`)
12. Tab "Passati di qui" su scheda Corner Free

### Fase D — Aeroplanini e dashboard
13. Hook `aeroplanini-check` post-azione
14. Home dashboard con slot Libri, zaino rapido, Aeroplanini, mini mappa

### Fase E — Cover, geocoding, stampa
15. Cascata cover Google → Open Library, salvataggio locale, riconoscimento placeholder
16. Setup punto: geocoding indirizzo + pin trascinabile + foto
17. Pagina stampa QR A5 (forex)

### Fase F — Polish PWA
18. Bootstrap base + CSS custom (verifica nessuna dipendenza residua da Tailwind)
19. Onboarding 4 slide
20. Capacitor post-MVP

---

## 22. SETUP SVILUPPO LOCALE

```bash
# Database e Redis
docker compose up -d

# Server
cd server && cp .env.example .env && npm install && npx prisma migrate dev && npm run dev

# Client (altro terminale)
cd client && npm install && npm run dev
```

**Porte default:**
- Client: `http://localhost:5173`
- API: `http://localhost:3001`
- PostgreSQL: `localhost:5433` (db: `libery`, user: `libery`)
- Redis: `localhost:6379`

---

## 23. CHANGELOG v2 → v3

- ✂️ Rimosso sistema **Timbri** e tabella `user_badges` → sostituiti da **Aeroplanini** (`user_aeroplanini`)
- ➕ Aggiunto sistema **Libri** (slot per prendere) con `users.libri_extra`, `users.libri_oggi_used`
- ➕ Reset slot a mezzanotte (BullMQ cron)
- ✂️ Rimosso `point_books.pending_copies` e l'intera "coda di validazione" — sostituiti dal **"Ricevuto" dell'addetto allo scan QR**
- ➕ Tabella `notifications` con **polling mirato** (solo schermate QR utente / SCAN responsabile, non globale)
- 🔄 **Responsabile = utente** con sezione "Il mio punto" e pulsante SCAN dedicato
- 🔄 **QR utente** ora è stringa `L|P,ISBN,user_id` stateless e senza TTL
- 🔄 **Camera unica**: niente più ISBN Mode vs QR Mode; comportamento contestuale in base a cosa si inquadra
- 🔄 **Card libro post-scansione**: un solo bottone **Lascia**. "Prendi" mai sul libro; sempre dal posto
- 🔄 **Scheda libro completa**: solo informazioni, nessun bottone azione; sezione "Dove è presente" ordinata per vicinanza
- 🔄 **Flusso Lascia unificato**: default QR Punto Certificato, sotto "Sono a un Corner Free?" (GPS / cerca / QR corner)
- 🔄 **Flusso Prendi**: sempre dalla lista del posto (3 modi di arrivare: QR cartello, GPS, mappa/ricerca)
- 🔄 **Corner Free libro non in lista**: l'utente lo prende fisicamente e basta — il libro rientra nel circuito quando lo Lascia altrove (nessun censimento forzato)
- ➕ Tab **"Passati di qui"** su Corner Free (storico transazioni)
- 🔄 Stack frontend: **Bootstrap + CSS ad hoc** (niente Tailwind)
- 🔄 Cover: cascata Google Books → Open Library + riconoscimento placeholder (575×750 + MD5)
- 🔄 `transactions.user_id` nullable per gestire correzioni a posteriori dell'addetto ("consegna senza QR")
- ➕ Inserimento manuale ISBN ovunque serva scansionare un libro (fallback codice rovinato)
