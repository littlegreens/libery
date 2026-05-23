# Material 3 web component (material-esm/material)

Usiamo il fork **[material-esm/material](https://github.com/material-esm/material)** (componenti Material 3 in ESM + Lit), allineato alla documentazione di [material-web.dev](https://material-web.dev/).

## Installazione e bootstrap

- Dipendenza: `material` (sorgente `github:material-esm/material`, risolta nel workspace in `node_modules/material`).
- Tema: `src/styles/material-theme.css` (colori Libery mappati su token `--md-sys-color-*`).
- Registrazione componenti: `src/lib/material/registerMaterial.ts` (import side-effect importati da `main.tsx`).

Tipi JSX per i tag usati nello shell: `src/types/material-shell.d.ts`.

## App shell (`AppShell`)

- **Header:** `md-icon-button` (hamburger) apre il drawer; `md-icon` «more_vert» apre `md-menu` in popover — **Accedi** (ospite) oppure **Profilo**, **Dashboard** (solo admin), **Il mio punto** (solo responsabile punto), **Esci** (loggato).
- **Drawer (`md-list` / `md-list-item`):** ospite: **Home**, **Mappa**, **Libri**; loggato: aggiunge **Zaino**. In fondo solo **Accedi** oppure **Esci** (`md-button` testo).

Aggiungi nuovi import in `registerMaterial.ts`, ad esempio:

```ts
import 'material/dialog/dialog.js';
```

Poi usa in React (o HTML) il tag documentato (es. `md-dialog`, verificabile nel sorgente del repo o su material-web.dev).

## Colori Libery su Material

Palette definita in CSS:

| Ruolo                         | Variabili principali                                                                              |
|------------------------------|---------------------------------------------------------------------------------------------------|
| Neutri (bianco/nero/grigi)    | `--md-sys-color-background`, `--md-sys-color-surface`, `--md-sys-color-on-*`, ecc.               |
| Avviso informativo (blu)      | `--libery-alert-info-*`; in MD3 anche `secondary` / `secondary-container`                         |
| Stato positivo (verde pastello) | `--libery-alert-success-*`; in MD3 `tertiary` / `tertiary-container`                          |
| Errore (rosso pastello)       | `--md-sys-color-error*`, `--libery-alert-error-*`                                                |

Per rifinire: [Material Theme Builder](https://material-foundation.github.io/material-theme-builder/) → export CSS → puoi fondere token generati con i nostri `--libery-md-*`.

## Web component custom (Lit)

Cartella suggerita: `src/web-components/`.

Modello:

1. Estendi `LitElement`, definisci `static properties` / `styles` / `render`.
2. Chiama `customElements.define('libery-nome-elemento', Classe)` una sola volta.
3. Import side-effect nel bootstrap (come `libery-alert-banner`) o nella feature che lo usa.

Esempio già incluso: `libery-alert-banner` (`variant="info"|"success"|"error"`, attributo `message`).

---

In React gli attributi degli custom element sono spesso **kebab-case** in DOM. Per `<md-*>` e `<libery-*>` usa `eslint-disable`/`@ts-expect-error` sul tag se TypeScript lamenta tipi JSX, oppure un wrapper `<div ref={…}>` con `createElement` / `ref` che imposta le **property** Lit (non solo attributi stringa).
