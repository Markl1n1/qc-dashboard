
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from './components/Layout';
import Index from './pages/Index';
import Upload from './pages/Upload';
import DialogDetail from './pages/DialogDetail';
import Settings from './pages/Settings';
import EnhancedSettings from './pages/EnhancedSettings';
import Auth from './pages/Auth';
import Login from './pages/Login';
import EmailConfirmed from './pages/EmailConfirmed';
import NotFound from './pages/NotFound';
import Dashboard from './pages/Dashboard';
import { useAuthStore } from './store/authStore';
import { useTheme } from './hooks/useTheme';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  const { initializeAuth } = useAuthStore();
  const { theme } = useTheme();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/login" element={<Login />} />
          <Route path="/email-confirmed" element={<EmailConfirmed />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout>
                <Index />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/upload" element={
            <ProtectedRoute>
              <Layout>
                <Upload />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/dialog/:id" element={
            <ProtectedRoute>
              <Layout>
                <DialogDetail />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/enhanced-settings" element={
            <ProtectedRoute>
              <Layout>
                <EnhancedSettings />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster theme={theme} />
      </div>
    </Router>
  );
}

export default App;
