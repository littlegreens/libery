# Superfici UI Libery: campi, tooltip, badge e chip

Documento operativo per allineare testi corti e controlli form senza reinventare Bootstrap. Il tema colore è in `src/styles/material-theme.css`; le utility leggere sono in `src/styles/libery-base.scss`.

---

## Campi (`md-text-field`)

- **Etichetta flottante**: prop `label` (obbligatoria salvo eccezioni).
- **Testo di aiuto persistente**: `supporting-text` sul componente Lit (via `MdTextField` è `supportingText` in JSX).
- **Errore visivo + messaggio**: `error` + `error-text` (in JSX `errorText`).
- **Validazione HTML**: `required`, `min-length`, `max-length`, `pattern`, ecc. dove supportato dal WC.
- **Form HTML**: gli `md-text-field` partecipano al valore modulo tramite le behaviour Lit; abbiamo anche `useMdNativeFormBridge` per **Invio** coerente con i `<form>` React.
- **Textarea lunga**: nessun `md-text-field` multiline dedicato nel bundle attuale → `<textarea class="libery-field-textarea">` + eventuali `.libery-field-hint` / `.libery-field-error` sotto.
- **Raggruppare più campi** con ritmo uniforme: wrapper `className="libery-field-stack"`.

---

## Tooltip (`MdTooltip` → `md-tooltip`)

- Wrapper attorno **al solo elemento trigger** (testo/icona/pulsante).
- **Plain**: `text="..."` oppure contenuto nello slot `text`.
- **Rich**: `type="rich"`, eventualmente `headline` / slot `headline` per titolo, slot `actions` per pulsanti.
- Comportamento: hover/focus con delay (~500 ms) lato Lit; contenuto inverso-su-superficie (inverse tokens).

Esempio:

```tsx
import { MdIconButton, MdIcon, MdTooltip } from '@/lib/material/md-react';

<MdTooltip text="Centra sulla tua posizione">
  <MdIconButton aria-label="GPS">
    <MdIcon>my_location</MdIcon>
  </MdIconButton>
</MdTooltip>
```

---

## Badge conteggio / dot (`MdBadge` → `md-badge`)

- È il **badge da icona**: pallino rosso o **numero** (`value="3"`).
- Va posizionato **vicino all’anchor** che ha `position: relative` (stili nel componente sono `absolute` sul badge).

Distinto dai **pill di testo** (vedi sotto).

---

## Pill testuali (`span.libery-badge`)

- Etichette **non interattive** compatte (ruolo utente, genere libro, stato testuale).
- Varianti di stato (stesso vocabolario delle alert inline):

  | Classe                     | Uso suggerito        |
  | -------------------------- | -------------------- |
  | `.libery-badge`            | neutro (default)    |
  | `.libery-badge--success`   | stato OK / attivo    |
  | `.libery-badge--info`      | informativo          |
  | `.libery-badge--error`     | errore / sospeso     |

---

## Chip statiche (`span.libery-chip`)

- Piccole **pill rettangolari** per tag, tipo punto, snippet su card quando **non serve** ripple/focus/tastiera MD.
- Modificatori: `--outline`, `--tonal`, `--success`, `--info`, `--error`.

Quando serve **filtro cliccabile**, **selezionabile**, o **rimuovibile** → usa **`MdChip`** dentro **`MdChipSet`**:

- `type="assist" | "filter" | "suggestion" | "input"`
- `label`, `selected`, `removable`, evento `@remove` (bridge React `onRemove` su `MdChip`).

---

## Pulsanti (`LiberyButton`)

Usare **`LiberyButton`** da `@/lib/material/md-react`, non `MdButton` diretto nelle CTA.

| Variante | Aspetto | Uso |
| -------- | ------- | --- |
| `primary` (default) | Sfondo giallo-soft, testo scuro — come «Vai a scheda» / punto più vicino | Azione principale |
| `secondary` | Bordo grigio, sfondo bianco | Annulla, seconda scelta, tab inattivo |
| `text` | Solo testo | Link-style (es. logout admin) |

Stili globali in `src/styles/_libery-buttons.scss` (mai nero pieno su `filled`).

---

## Dove non duplicare

- **Tipo punto in mappa / popup**: classi dedicate (es. `.map-popup-type--*`) restano perché agganciano colori geografici/markers.
- **Cover card libro**: `.book-card-cover-badge` è una chip **neutra** sulla copertina — concettualmente allineata a `.libery-chip` ma con layout fisso sulla thumb.
- **Prenotazioni**: `.book-card-reserved-badge` tiene il verde/branding reservation.

---

## Registro dei web component

Aggiungi in `registerMaterial.ts` quando introduci nuovi tag `material/...`; i wrapper React stanno in `src/lib/material/md-react.tsx`.
