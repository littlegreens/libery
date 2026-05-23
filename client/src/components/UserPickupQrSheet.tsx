import { useMemo } from 'react';
import LiberyBottomSheet from '@/components/LiberyBottomSheet';
import BookCoverThumb from '@/components/BookCoverThumb';
import { pickupQrImageUrl, buildPickupQrPayload } from '@/lib/userQr';
import { useAuthStore } from '@/stores/authStore';
import { useSlotsStore } from '@/stores/slotsStore';
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
  pointName: string;
  onVerified?: () => void;
};

/** QR `P,ISBN,user_id` — ritiro prenotazione in biblioteca/libreria. */
export default function UserPickupQrSheet({ open, onOpenChange, book, pointName, onVerified }: Props) {
  const userId = useAuthStore((s) => s.user?.id);

  useUserQrNotificationPoll({
    enabled: open,
    expectType: 'take_delivered',
    bookId: book.id,
    onDone: () => {
      void useSlotsStore.getState().refreshSlots();
      onOpenChange(false);
      onVerified?.();
    },
  });

  const payload = useMemo(() => {
    if (!userId) return '';
    return buildPickupQrPayload(book.isbn, userId);
  }, [book.isbn, userId]);

  const qrSrc = payload ? pickupQrImageUrl(payload, 260) : '';

  return (
    <LiberyBottomSheet open={open} onOpenChange={onOpenChange} title="QR ritiro" panelClass="libery-bottom-sheet-panel--qr">
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
          <img className="user-qr-sheet__qr" src={qrSrc} alt="" width={240} height={240} />
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
        <p className="user-qr-sheet__wait small text-muted mb-0">
          La schermata si chiude quando l&apos;addetto conferma il ritiro.
        </p>
      </div>
    </LiberyBottomSheet>
  );
}
