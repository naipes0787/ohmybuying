import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ScanlineOverlay } from '@/components/ui/ScanlineOverlay';
import { useAuthStore } from '@/stores/authStore';
import AuthPage from '@/pages/AuthPage';

const ListsPage = lazy(() => import('@/pages/ListsPage'));
const ListDetailPage = lazy(() => import('@/pages/ListDetailPage'));

export function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    initialize().then((fn) => {
      cleanup = fn;
    });
    return () => {
      cleanup?.();
    };
  }, [initialize]);

  return (
    <>
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<ListsPage />} />
              <Route path="/lists/:listId" element={<ListDetailPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <ScanlineOverlay />
    </>
  );
}
