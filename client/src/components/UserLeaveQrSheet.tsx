import { useMemo } from 'react';
import LiberyBottomSheet from '@/components/LiberyBottomSheet';
import BookCoverThumb from '@/components/BookCoverThumb';
import { buildLeaveQrPayload, pickupQrImageUrl } from '@/lib/userQr';
import { useAuthStore } from '@/stores/authStore';
import { useUserQrNotificationPoll } from '@/hooks/useUserQrNotificationPoll';

type BookInfo = {
  id: string;
  title: string;
  author?: string | null;
  isbn: string;
  coverPath?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: BookInfo;
  pointName?: string | null;
  onVerified?: () => void;
  /** Link sotto il QR: donazione in Corner Free (GPS + cartello). */
  showCornerOption?: boolean;
  onAtCorner?: () => void;
};

/** QR `L,ISBN,user_id` — l'addetto scansiona e preme «Ricevuto». */
export default function UserLeaveQrSheet({
  open,
  onOpenChange,
  book,
  pointName,
  onVerified,
  showCornerOption,
  onAtCorner,
}: Props) {
  const userId = useAuthStore((s) => s.user?.id);

  useUserQrNotificationPoll({
    enabled: open,
    expectType: 'leave_received',
    bookId: book.id,
    onDone: () => {
      onOpenChange(false);
      onVerified?.();
    },
  });

  const payload = useMemo(() => {
    if (!userId) return '';
    return buildLeaveQrPayload(book.isbn, userId);
  }, [book.isbn, userId]);

  const qrSrc = payload ? pickupQrImageUrl(payload, 280) : '';

  return (
    <LiberyBottomSheet open={open} onOpenChange={onOpenChange} title="QR donazione" panelClass="libery-bottom-sheet-panel--qr">
      <div className="user-qr-sheet">
        <div className="user-qr-sheet__book">
          <BookCoverThumb
            title={book.title}
            isbn={book.isbn}
            coverPath={book.coverPath}
            coverSize="list"
          />
          <div className="user-qr-sheet__book-text min-w-0">
            <p className="user-qr-sheet__title">{book.title}</p>
            {book.author ? <p className="user-qr-sheet__author">{book.author}</p> : null}
          </div>
        </div>
        {qrSrc ? (
          <img className="user-qr-sheet__qr" src={qrSrc} alt={`QR donazione — ${book.title}`} width={240} height={240} />
        ) : null}
        <p className="user-qr-sheet__lead">
          Mostra questo QR code al punto Libery
          {pointName ? (
            <>
              {' '}
              (<strong>{pointName}</strong>)
            </>
          ) : null}
          .
        </p>
        {showCornerOption && onAtCorner ? (
          <p className="user-qr-sheet__corner mb-0">
            <button
              type="button"
              className="user-qr-sheet__corner-link"
              onClick={() => {
                onOpenChange(false);
                onAtCorner();
              }}
            >
              Sei in un Corner Free?
            </button>
          </p>
        ) : null}
      </div>
    </LiberyBottomSheet>
  );
}
