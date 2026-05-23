import { css, html, LitElement } from 'lit';

export type LiberyPointTypeBadgeType = 'biblioteca' | 'libreria' | 'corner_free';
export type LiberyPointTypeBadgeSize = 'small' | 'medium';

const LABELS: Record<LiberyPointTypeBadgeType, string> = {
  biblioteca: 'Biblioteca',
  libreria: 'Libreria',
  corner_free: 'Corner Free',
};

const FILLS: Record<LiberyPointTypeBadgeType, string> = {
  biblioteca: '#4a6a8a',
  libreria: '#3d6b4a',
  corner_free: '#b35a20',
};

/**
 * Badge tipo punto Libery (unico elemento: liste, scheda, mappa, dialog).
 * Stile MD3: pill rettangolare arrotondata, fill tipo, testo bianco.
 */
export class LiberyPointTypeBadge extends LitElement {
  static properties = {
    pointType: { type: String, attribute: 'point-type', reflect: true },
    size: { type: String, reflect: true },
  };

  declare pointType: LiberyPointTypeBadgeType;
  declare size: LiberyPointTypeBadgeSize;

  constructor() {
    super();
    this.pointType = 'biblioteca';
    this.size = 'medium';
  }

  static styles = css`
    :host {
      display: inline-flex;
      vertical-align: middle;
      max-width: 100%;
      margin-bottom: 0.3rem;
    }

    :host(.flush) {
      margin-bottom: 0;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
      max-width: 100%;
      box-sizing: border-box;
      font-family: Roboto, system-ui, sans-serif;
      font-weight: 500;
      letter-spacing: 0.02em;
      line-height: 1.2;
      text-transform: none;
      color: #ffffff;
      white-space: nowrap;
      border: none;
    }

    :host([size='small']) .badge {
      font-size: 0.6875rem;
      font-weight: 500;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
    }

    :host([size='medium']) .badge {
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 0.3rem 0.65rem;
      border-radius: 8px;
    }
  `;

  render() {
    const t =
      this.pointType === 'libreria' || this.pointType === 'corner_free'
        ? this.pointType
        : 'biblioteca';
    const label = LABELS[t];
    const fill = FILLS[t];
    return html`<span class="badge" style="background-color: ${fill}">${label}</span>`;
  }
}

customElements.define('libery-point-type-badge', LiberyPointTypeBadge);

declare global {
  interface HTMLElementTagNameMap {
    'libery-point-type-badge': LiberyPointTypeBadge;
  }
}
