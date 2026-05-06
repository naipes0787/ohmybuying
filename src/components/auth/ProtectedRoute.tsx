import { Navigate, Outlet } from 'react-router-dom';
import { useAuthLoading, useSession } from '@/stores/authStore';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export function ProtectedRoute() {
  const session = useSession();
  const loading = useAuthLoading();

  if (loading) return <LoadingScreen message="AUTHENTICATING" />;
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}
