import { useEffect, useState } from 'react';
import { openLibraryCoverUrl, resolveCoverUrl } from '@/lib/coverUrl';

/** Rapporto tipico copertina (larghezza : altezza). */
export const BOOK_COVER_ASPECT = 2 / 3;

export type BookCoverSize = 'list' | 'sheet' | 'hero' | 'preview';

/** Lista: larghezza 3rem, altezza da rapporto copertina 2:3. */
const COVER_DIMS: Record<BookCoverSize, { width: number; height?: number }> = {
  list: { width: 48 },
  sheet: { width: 88 },
  hero: { width: 112 },
  preview: { width: 128 },
};

type Props = {
  title: string;
  isbn?: string;
  coverPath?: string | null;
  /** Larghezza in px; altezza = larghezza / {@link BOOK_COVER_ASPECT}. */
  size?: number;
  /** Preset dimensioni (ignorato se `size` è impostato). */
  coverSize?: BookCoverSize;
  className?: string;
};

function coverDimensions(props: Pick<Props, 'size' | 'coverSize'>): { width: number; height: number } {
  if (props.size != null && props.size > 0) {
    const width = props.size;
    return { width, height: Math.round(width / BOOK_COVER_ASPECT) };
  }
  const preset = COVER_DIMS[props.coverSize ?? 'list'];
  return {
    width: preset.width,
    height: preset.height ?? Math.round(preset.width / BOOK_COVER_ASPECT),
  };
}

function coverBoxStyle(width: number, height: number): { width: number; height: number } {
  return { width, height };
}

function BookPlaceholder({
  initial,
  width,
  height,
  className,
}: {
  initial: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <span
      className={['book-cover-thumb', 'book-cover-thumb--placeholder', className].filter(Boolean).join(' ')}
      style={coverBoxStyle(width, height)}
      aria-hidden
    >
      <svg
        className="book-cover-thumb__icon"
        viewBox="0 0 24 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 3h7v26H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <path d="M11 3h9a1 1 0 0 1 1 1v24a1 1 0 0 1-1 1h-9V3z" />
        <path d="M11 3v26" />
      </svg>
      {initial ? <span className="book-cover-thumb__initial">{initial}</span> : null}
    </span>
  );
}

export default function BookCoverThumb({ title, isbn, coverPath, size, coverSize, className }: Props) {
  const initial = title.trim().charAt(0).toUpperCase() || '';
  const { width, height } = coverDimensions({ size, coverSize });
  const primarySrc = isbn ? resolveCoverUrl(coverPath, isbn) : coverPath?.trim() || null;
  const [src, setSrc] = useState<string | null>(primarySrc);

  useEffect(() => {
    setSrc(primarySrc);
  }, [primarySrc]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={['book-cover-thumb', className].filter(Boolean).join(' ')}
        width={width}
        height={height}
        style={coverBoxStyle(width, height)}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          if (!isbn) {
            setSrc(null);
            return;
          }
          const fallback = openLibraryCoverUrl(isbn);
          if (src !== fallback) {
            setSrc(fallback);
            return;
          }
          setSrc(null);
        }}
      />
    );
  }

  return <BookPlaceholder initial={initial} width={width} height={height} className={className} />;
}
