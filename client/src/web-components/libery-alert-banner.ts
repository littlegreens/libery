/**
 * Esempio di web component custom (Lit) quando non esiste un `md-*` adatto.
 * Varianti: info (blu), success (verde pastello), error (rosso pastello).
 */
import { css, html, LitElement } from 'lit';

export type LiberyAlertVariant = 'info' | 'success' | 'error';

export class LiberyAlertBanner extends LitElement {
  static properties = {
    variant: { type: String, reflect: true },
    message: { type: String },
  };

  declare variant: LiberyAlertVariant;
  declare message: string;

  constructor() {
    super();
    this.variant = 'info';
    this.message = '';
  }

  static styles = css`
    :host {
      display: block;
    }
    .wrap {
      border-radius: 12px;
      padding: 12px 16px;
      font-size: 0.95rem;
      line-height: 1.4;
      border: 1px solid transparent;
    }
    .info {
      background: var(--libery-alert-info-bg);
      color: var(--libery-alert-info-ink);
      border-color: color-mix(in srgb, var(--libery-md-blue-alert) 55%, transparent);
    }
    .success {
      background: var(--libery-alert-success-bg);
      color: var(--libery-alert-success-ink);
      border-color: color-mix(in srgb, var(--libery-md-green-pastel) 55%, transparent);
    }
    .error {
      background: var(--libery-alert-error-bg);
      color: var(--libery-alert-error-ink);
      border-color: color-mix(in srgb, var(--libery-md-red-pastel) 55%, transparent);
    }
  `;

  render() {
    const v = this.variant === 'success' || this.variant === 'error' ? this.variant : 'info';
    return html`<div class="wrap ${v}" role="status">${this.message}</div>`;
  }
}

customElements.define('libery-alert-banner', LiberyAlertBanner);

declare global {
  interface HTMLElementTagNameMap {
    'libery-alert-banner': LiberyAlertBanner;
  }
}
