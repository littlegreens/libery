/**
 * Wrapper React per Material web components (Lit) via `@lit/react`.
 *
 * Linee guida sintetiche (dettaglio in `docs/LIBERY_SURFACES.md`):
 * - Campi: `MdTextField` usa `label`, `supporting-text`, `error` + `error-text`; textarea native → classe `.libery-field-textarea` + `.libery-field-hint`.
 * - Tooltip: `MdTooltip` avvolge il trigger (es. icon button); testo corto con `text`, oppure `type="rich"`.
 * - Badge conteggio su icone: `MdBadge` (punto rosso / numero).
 * - Chip interattivi: `MdChipSet` + `MdChip`; **etichette leggere**: `MdChip` `type="assist"` **disabled** (`LiberyAssistLabelChip`).
 */
import { createComponent } from '@lit/react';
import React from 'react';
import type { NavigateOptions, To } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Badge } from 'material/badge/badge.js';
import { Button } from 'material/buttons/button.js';
import { IconButton } from 'material/buttons/icon-button.js';
import { Chip } from 'material/chips/chip.js';
import { ChipSet } from 'material/chips/chip-set.js';
import { Icon } from 'material/icon/icon.js';
import { Card } from 'material/card/card.js';
import { Divider } from 'material/divider/divider.js';
import { Elevation } from 'material/internal/elevation/elevation.js';
import { List } from 'material/list/list.js';
import { ListItem } from 'material/list/list-item.js';
import { TextField } from 'material/text/text-field.js';
import { Tooltip } from 'material/tooltip/tooltip.js';

// createComponent inferisce Male i props Lit su HTMLElement; qui usiamo any per JSX pratico.
export const MdIcon = createComponent({
  react: React,
  tagName: 'md-icon',
  elementClass: Icon,
}) as any;

export const MdButton = createComponent({
  react: React,
  tagName: 'md-button',
  elementClass: Button,
}) as any;

/** Variante visiva Libery: primario (tonal giallo/grigio) | secondario (bordo grigio) | text */
export type LiberyButtonVariant = 'primary' | 'secondary' | 'text';

export type LiberyButtonProps = Record<string, unknown> & {
  variant?: LiberyButtonVariant;
  className?: string;
  color?: string;
  size?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  children?: React.ReactNode;
};

/**
 * Pulsante standard Libery. Usare al posto di `MdButton` nelle CTA.
 * Non usa mai il nero pieno: primario = come scheda libro, secondario = outlined grigio.
 */
function resolveButtonVariant(
  variant: LiberyButtonVariant,
  color?: string,
): { variant: LiberyButtonVariant; color: string } {
  if (color) {
    const v: LiberyButtonVariant =
      color === 'outlined' ? 'secondary' : color === 'text' ? 'text' : 'primary';
    return { variant: v, color };
  }
  const resolvedColor =
    variant === 'primary' ? 'tonal' : variant === 'secondary' ? 'outlined' : 'text';
  return { variant, color: resolvedColor };
}

export function LiberyButton({
  variant = 'primary',
  color,
  className = '',
  ...rest
}: LiberyButtonProps) {
  const { variant: v, color: resolvedColor } = resolveButtonVariant(variant, color);
  const cls = ['libery-btn', `libery-btn--${v}`, className].filter(Boolean).join(' ');
  return <MdButton color={resolvedColor} className={cls} {...rest} />;
}

export const MdIconButton = createComponent({
  react: React,
  tagName: 'md-icon-button',
  elementClass: IconButton,
}) as any;

export const MdTextField = createComponent({
  react: React,
  tagName: 'md-text-field',
  elementClass: TextField,
  events: {
    onInput: 'input',
    onChange: 'change',
    onBlur: 'blur',
    onKeyDown: 'keydown',
  },
}) as any;

export const MdCard = createComponent({
  react: React,
  tagName: 'md-card',
  elementClass: Card,
}) as any;

/** Lista MD3: ospita `MdListItem`; container con `role="list"` e navigazione da tastiera interna. */
export const MdList = createComponent({
  react: React,
  tagName: 'md-list',
  elementClass: List,
}) as any;

/** Riga lista: slot `start`, `headline`, `supporting-text`; `type` `text` | `button` | `link`. */
export const MdListItem = createComponent({
  react: React,
  tagName: 'md-list-item',
  elementClass: ListItem,
  events: {
    onClick: 'click',
    onRequestActivation: 'request-activation',
  },
}) as any;

export const MdDivider = createComponent({
  react: React,
  tagName: 'md-divider',
  elementClass: Divider,
}) as any;

/** Ombra da token `--md-elevation-level` / `--md-elevation-shadow-color` (host `position` non `static`). */
export const MdElevation = createComponent({
  react: React,
  tagName: 'md-elevation',
  elementClass: Elevation,
}) as any;

/** Tooltip MD3: wrappa il trigger nel default slot; usa `text` o slot `text` / `headline`. */
export const MdTooltip = createComponent({
  react: React,
  tagName: 'md-tooltip',
  elementClass: Tooltip,
}) as any;

/** Chip (assist / filter / suggestion / input): `label`, `type`, `selected`, `removable`, slot `icon`. */
export const MdChip = createComponent({
  react: React,
  tagName: 'md-chip',
  elementClass: Chip,
  events: {
    onRemove: 'remove',
  },
}) as any;

/** Raggruppa chip con navigazione da tastiera orizzontale (toolbar). */
export const MdChipSet = createComponent({
  react: React,
  tagName: 'md-chip-set',
  elementClass: ChipSet,
}) as any;

/** Badge numerico o punto su un’ancora (tipicamente dentro un wrapper `position: relative`). */
export const MdBadge = createComponent({
  react: React,
  tagName: 'md-badge',
  elementClass: Badge,
}) as any;

/**
 * Equivale ancoraggio SPA a `Link` usando `navigate()`, con styling `md-button`.
 */
export type MdNavigateButtonProps = React.PropsWithChildren<
  Record<string, unknown> & {
    to: To;
    navigateOptions?: NavigateOptions;
    onClick?: React.MouseEventHandler<HTMLElement>;
    /** Comportamento `type` sul pulsante (`submit` sarebbe dannoso dentro form). Default: button */
    nativeButtonType?: 'button' | 'submit' | 'reset';
  }
>;

export function MdNavigateButton({
  to,
  navigateOptions,
  onClick,
  disabled,
  nativeButtonType = 'button',
  ...rest
}: MdNavigateButtonProps) {
  const navigate = useNavigate();
  const isDisabled = Boolean(disabled);
  return (
    <LiberyButton
      {...rest}
      type={nativeButtonType}
      disabled={isDisabled}
      onClick={(e: React.MouseEvent<HTMLElement>) => {
        onClick?.(e);
        if (!isDisabled) navigate(to, navigateOptions);
      }}
    />
  );
}
