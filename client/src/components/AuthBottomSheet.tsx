import AuthForm from '@/components/AuthForm';
import LiberyBottomSheet from '@/components/LiberyBottomSheet';
import type { AuthUser } from '@/stores/authStore';

type Props = {
  open: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onSuccess?: (user: AuthUser) => void;
};

export default function AuthBottomSheet({ open, onClose, initialMode = 'login', onSuccess }: Props) {
  const title = initialMode === 'register' ? 'Registrati' : 'Accedi';

  function handleSuccess(user: AuthUser) {
    onClose();
    onSuccess?.(user);
  }

  return (
    <LiberyBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
      panelClass="libery-bottom-sheet-panel--auth"
      heading={
        <h2 className="libery-auth-sheet-title h6 mb-0 text-center">{title}</h2>
      }
    >
      <div className="libery-auth-sheet">
        <AuthForm initialMode={initialMode} onSuccess={handleSuccess} />
      </div>
    </LiberyBottomSheet>
  );
}
