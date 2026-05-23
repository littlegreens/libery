import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';

export type UserQrNotifType = 'leave_received' | 'take_delivered';

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
};

type Options = {
  enabled: boolean;
  expectType: UserQrNotifType;
  bookId: string;
  onDone: () => void;
};

/**
 * Polling 2.5s mentre il QR è visibile — chiude il flusso quando l'addetto conferma.
 */
export function useUserQrNotificationPoll({ enabled, expectType, bookId, onDone }: Options) {
  const sinceRef = useRef<string>(new Date().toISOString());
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);

  onDoneRef.current = onDone;

  useEffect(() => {
    if (!enabled) return;
    doneRef.current = false;
    sinceRef.current = new Date().toISOString();

    const tick = async () => {
      if (doneRef.current) return;
      try {
        const { data } = await api.get<{ notifications: NotificationRow[] }>('/notifications', {
          params: { since: sinceRef.current, limit: 15 },
        });
        const hit = data.notifications.find((n) => {
          if (n.type !== expectType) return false;
          const bid = n.data && typeof n.data.bookId === 'string' ? n.data.bookId : null;
          return bid === bookId;
        });
        if (!hit) return;
        doneRef.current = true;
        try {
          await api.post(`/notifications/${hit.id}/read`);
        } catch {
          /* ok */
        }
        onDoneRef.current();
      } catch {
        /* rete: riprova al prossimo tick */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 2500);
    return () => window.clearInterval(id);
  }, [enabled, expectType, bookId]);
}
