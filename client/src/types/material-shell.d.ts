import type { CSSProperties, DetailedHTMLProps, HTMLAttributes } from 'react';

type MdDiv = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-menu': MdDiv & {
        anchor?: string;
        open?: boolean;
        quick?: boolean;
        positioning?: string;
        'has-overflow'?: boolean;
        'stay-open-on-focusout'?: boolean;
        'anchor-corner'?: string;
        'menu-corner'?: string;
      };
      'md-menu-item': MdDiv;
      'md-list': MdDiv;
      'md-list-item': MdDiv & {
        type?: 'text' | 'button' | 'link';
        disabled?: boolean;
        href?: string;
        target?: string;
        'data-nav-to'?: string;
      };
      'md-divider': MdDiv & {
        inset?: boolean;
        'inset-start'?: boolean;
        'inset-end'?: boolean;
      };
      'md-elevation': MdDiv & { style?: CSSProperties };
      'md-search': MdDiv & {
        label?: string;
        placeholder?: string;
        value?: string;
      };
      'md-card': MdDiv & { type?: 'elevated' | 'outlined' | 'filled' };
      'md-icon-button': MdDiv & { color?: string };
      'md-icon': MdDiv;
      'md-button': MdDiv & { color?: string };
      'md-tooltip': MdDiv & {
        type?: 'plain' | 'rich';
        text?: string;
        headline?: string;
        open?: boolean;
      };
      'md-chip': MdDiv & {
        label?: string;
        type?: 'assist' | 'filter' | 'input' | 'suggestion';
        selected?: boolean;
        disabled?: boolean;
        removable?: boolean;
      };
      'md-chip-set': MdDiv;
      'md-badge': MdDiv & { value?: string };
    }
  }
}
