import { Navigate, Routes, Route } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import ToastContainer from '@/components/ToastContainer';
import RootRedirect from '@/components/RootRedirect';
import AuthPage from '@/pages/AuthPage';
import MapPage from '@/pages/MapPage';
import SearchBooksPage from '@/pages/SearchBooksPage';
import BackpackPage from '@/pages/BackpackPage';
import PointPage from '@/pages/PointPage';
import BookPage from '@/pages/BookPage';
import WelcomePage from '@/pages/WelcomePage';
import ProfilePage from '@/pages/ProfilePage';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminPoints from '@/pages/admin/AdminPoints';
import AdminRequests from '@/pages/admin/AdminRequests';
import ManagerPage from '@/pages/ManagerPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import BecomePointPage from '@/pages/BecomePointPage';
import NotFoundPage from '@/components/NotFoundPage';

export default function App() {
  return (
    <>
    <Routes>
      <Route path="/entra" element={<AuthPage />} />
      <Route path="/registrati" element={<AuthPage />} />
      <Route path="/verifica-email" element={<VerifyEmailPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="richieste" element={<AdminRequests />} />
        <Route path="punti" element={<AdminPoints />} />
        <Route path="utenti" element={<AdminUsers />} />
      </Route>

      <Route element={<AppShell />}>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/home" element={<WelcomePage />} />
        <Route path="/mappa" element={<MapPage />} />
        <Route path="/libri" element={<SearchBooksPage />} />
        <Route path="/cerca" element={<Navigate to="/libri" replace />} />
        <Route path="/zaino" element={<BackpackPage />} />
        <Route path="/profilo" element={<ProfilePage />} />
        <Route path="/punto/:id" element={<PointPage />} />
        <Route path="/libro/:id" element={<BookPage />} />
        <Route path="/gestore" element={<ManagerPage />} />
        <Route path="/diventa-punto" element={<BecomePointPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    <ToastContainer />
    </>
  );
}
