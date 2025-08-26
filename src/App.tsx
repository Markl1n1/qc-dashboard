
import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LazyProtectedRoute from './components/LazyProtectedRoute';
import './App.css';

// Lazy load components
const Login = lazy(() => import('./pages/Login'));
const Auth = lazy(() => import('./pages/Auth'));
const EmailConfirmed = lazy(() => import('./pages/EmailConfirmed'));
const UnifiedDashboard = lazy(() => import('./pages/UnifiedDashboard'));
const Upload = lazy(() => import('./pages/Upload'));
const DialogDetail = lazy(() => import('./pages/DialogDetail'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route
              path="/login"
              element={
                <Suspense fallback={<div>Loading...</div>}>
                  <Login />
                </Suspense>
              }
            />
            <Route
              path="/auth"
              element={
                <Suspense fallback={<div>Loading...</div>}>
                  <Auth />
                </Suspense>
              }
            />
            <Route
              path="/email-confirmed"
              element={
                <Suspense fallback={<div>Loading...</div>}>
                  <EmailConfirmed />
                </Suspense>
              }
            />
            <Route
              path="/"
              element={
                <LazyProtectedRoute>
                  <Layout>
                    <UnifiedDashboard />
                  </Layout>
                </LazyProtectedRoute>
              }
            />
            <Route
              path="/upload"
              element={
                <LazyProtectedRoute>
                  <Layout>
                    <Upload />
                  </Layout>
                </LazyProtectedRoute>
              }
            />
            <Route
              path="/dialog/:id"
              element={
                <LazyProtectedRoute>
                  <Layout>
                    <DialogDetail />
                  </Layout>
                </LazyProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <LazyProtectedRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </LazyProtectedRoute>
              }
            />
            <Route
              path="*"
              element={
                <Suspense fallback={<div>Loading...</div>}>
                  <NotFound />
                </Suspense>
              }
            />
          </Routes>
          <Toaster />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
