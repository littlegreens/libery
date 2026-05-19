import { useEffect } from 'react';
import AuthForm from '@/components/AuthForm';
import type { AuthUser } from '@/stores/authStore';

type Props = {
  open: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onSuccess?: (user: AuthUser) => void;
};

export default function AuthBottomSheet({ open, onClose, initialMode = 'login', onSuccess }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  function handleSuccess(user: AuthUser) {
    onClose();
    onSuccess?.(user);
  }

  return (
    <>
      <button type="button" className="auth-sheet-backdrop" onClick={onClose} aria-label="Chiudi" />
      <section className="auth-sheet" role="dialog" aria-modal="true" aria-labelledby="auth-sheet-title">
        <span className="auth-sheet-handle" aria-hidden />
        <h2 id="auth-sheet-title" className="auth-sheet-title h6 mb-3 text-center">
          Entra in Libery
        </h2>
        <AuthForm initialMode={initialMode} onSuccess={handleSuccess} />
      </section>
    </>
  );
}
