import type { KeyboardEvent, KeyboardEventHandler, Ref } from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';

type MdSearchEl = HTMLElement & {
  label?: string;
  placeholder?: string;
  value: string;
};

export type MaterialSearchFieldProps = {
  id?: string;
  label: string;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
};

/**
 * **`md-search`** del package Material (fork): pill outlined + clear nel campo interno.
 * @see https://m3.material.io/components/search/overview
 */
export default function MaterialSearchField({
  id,
  label,
  placeholder,
  value,
  onValueChange,
  disabled,
  className,
  onKeyDown,
}: MaterialSearchFieldProps) {
  const ref = useRef<MdSearchEl | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.value !== value) {
      el.value = value;
    }
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function readValue() {
      const node = ref.current;
      return node?.value ?? '';
    }

    const onInput = () => onValueChange(readValue());
    el.addEventListener('input', onInput);
    return () => el.removeEventListener('input', onInput);
  }, [onValueChange]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onKeyDown) return;
    const fn = (e: Event) => {
      // Evento DOM nativo dal campo interno; React Router/form non usa SyntheticEvent qui.
      onKeyDown(e as unknown as KeyboardEvent<HTMLElement>);
    };
    el.addEventListener('keydown', fn, true);
    return () => el.removeEventListener('keydown', fn, true);
  }, [onKeyDown]);

  return (
    <div
      className={[
        'libery-material-search-host',
        disabled ? 'libery-material-search-host--disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <md-search
        ref={ref as Ref<MdSearchEl>}
        {...(id ? { id } : {})}
        label={label}
        placeholder={placeholder ?? ''}
      />
    </div>
  );
}
