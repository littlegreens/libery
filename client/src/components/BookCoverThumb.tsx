import { useEffect, useState } from 'react';
import { openLibraryCoverUrl, resolveCoverUrl } from '@/lib/coverUrl';

type Props = {
  title: string;
  isbn?: string;
  coverPath?: string | null;
  size?: number;
};

/**
 * Placeholder vettoriale: libro stilizzato + iniziale del titolo.
 * Si adatta a qualsiasi dimensione (viewBox 24x24, currentColor).
 */
function BookPlaceholder({ initial, size }: { initial: string; size: number }) {
  return (
    <span
      className="book-cover-thumb book-cover-thumb--placeholder"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="book-cover-thumb__icon"
      >
        {/* libro aperto stilizzato */}
        <path d="M3 5.5c2.5-1 5-1 8 .5v13c-3-1.5-5.5-1.5-8-.5v-13z" />
        <path d="M21 5.5c-2.5-1-5-1-8 .5v13c3-1.5 5.5-1.5 8-.5v-13z" />
        <path d="M12 6v13" />
      </svg>
      {initial && <span className="book-cover-thumb__initial">{initial}</span>}
    </span>
  );
}

export default function BookCoverThumb({ title, isbn, coverPath, size = 48 }: Props) {
  const initial = title.trim().charAt(0).toUpperCase() || '';
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
        className="book-cover-thumb"
        width={size}
        height={size}
        loading="lazy"
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

  return <BookPlaceholder initial={initial} size={size} />;
}
