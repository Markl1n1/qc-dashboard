
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useEffect, useState } from 'react';

const Index = () => {
  const { isAuthenticated, initializeAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await initializeAuth();
      setIsLoading(false);
    };
    init();
  }, [initializeAuth]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // If user is authenticated, redirect to unified dashboard
  if (isAuthenticated) {
    return <Navigate to="/unified-dashboard" replace />;
  }
  
  // If user is not authenticated, redirect to auth page
  return <Navigate to="/auth" replace />;
};

export default Index;
