import { useEffect, useMemo, useRef, useState } from 'react';
import { bookDescriptionParagraphs } from '@/lib/bookDescription';
import { LiberyButton } from '@/lib/material/md-react';

type Props = {
  description: string;
  className?: string;
  paragraphClassName?: string;
};

/** Trama libro: max 8 righe, poi «Leggi altro» / «Mostra meno» (MD text button). */
export default function BookDescriptionBody({
  description,
  className,
  paragraphClassName = 'book-description-para',
}: Props) {
  const paragraphs = useMemo(() => bookDescriptionParagraphs(description), [description]);
  const textRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [description]);

  useEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;

    const measure = () => {
      setTruncated(el.scrollHeight > el.clientHeight + 2);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paragraphs, expanded]);

  if (paragraphs.length === 0) return null;

  const showToggle = truncated || expanded;

  return (
    <div
      className={[
        'book-description',
        expanded ? 'book-description--expanded' : 'book-description--clamped',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div ref={textRef} className="book-description__text">
        {paragraphs.map((p, i) => (
          <p key={i} className={paragraphClassName}>
            {p}
          </p>
        ))}
      </div>
      {showToggle ? (
        <LiberyButton
          type="button"
          color="text"
          className="book-description__toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Mostra meno' : 'Leggi altro'}
        </LiberyButton>
      ) : null}
    </div>
  );
}
