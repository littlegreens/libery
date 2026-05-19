import { Link } from 'react-router-dom';

type Props = { title: string; subtitle?: string };

export default function PlaceholderPage({ title, subtitle }: Props) {
  return (
    <div className="page-shell min-vh-100 px-4 py-4">
      <Link to="/" className="text-muted small text-decoration-none d-inline-block mb-4">
        ← Home
      </Link>
      <h1 className="h4 fw-bold">{title}</h1>
      <p className="text-muted">{subtitle ?? 'In arrivo nella prossima fase di sviluppo.'}</p>
    </div>
  );
}
