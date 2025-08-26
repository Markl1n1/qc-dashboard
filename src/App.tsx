
import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy load pages for better performance
const Index = lazy(() => import('./pages/Index'));
const Auth = lazy(() => import('./pages/Auth'));
const Login = lazy(() => import('./pages/Login'));
const UnifiedDashboard = lazy(() => import('./pages/UnifiedDashboard'));
const Upload = lazy(() => import('./pages/Upload'));
const DialogDetail = lazy(() => import('./pages/DialogDetail'));
const Settings = lazy(() => import('./pages/Settings'));
const AgentManagement = lazy(() => import('./pages/AgentManagement'));
const NotFound = lazy(() => import('./pages/NotFound'));
const EmailConfirmed = lazy(() => import('./pages/EmailConfirmed'));

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-background">
          <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/login" element={<Login />} />
              <Route path="/email-confirmed" element={<EmailConfirmed />} />
              
              {/* Protected routes with layout */}
              <Route element={<Layout />}>
                {/* Redirect legacy dashboard route to unified dashboard */}
                <Route path="/dashboard" element={<Navigate to="/unified-dashboard" replace />} />
                
                <Route path="/unified-dashboard" element={
                  <ProtectedRoute>
                    <UnifiedDashboard />
                  </ProtectedRoute>
                } />
                
                <Route path="/upload" element={
                  <ProtectedRoute>
                    <Upload />
                  </ProtectedRoute>
                } />
                
                <Route path="/dialog/:id" element={
                  <ProtectedRoute>
                    <DialogDetail />
                  </ProtectedRoute>
                } />
                
                <Route path="/agents" element={
                  <ProtectedRoute>
                    <AgentManagement />
                  </ProtectedRoute>
                } />
                
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <Toaster />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
