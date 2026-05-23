import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { MdNavigateButton } from '@/lib/material/md-react';

export default function NotFoundPage() {
  useDocumentTitle('Pagina non trovata');

  return (
    <div className="page-content px-3 py-5 text-center">
      <h1 className="h5 fw-bold mb-2">Pagina non trovata</h1>
      <p className="text-muted small mb-3">Il link non esiste o non è più valido.</p>
      <MdNavigateButton to="/mappa" color="filled">
        Vai alla mappa
      </MdNavigateButton>
    </div>
  );
}
