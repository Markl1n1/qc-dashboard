
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const Index = () => {
  const { isAuthenticated } = useAuthStore();
  
  // If user is authenticated, redirect to unified dashboard
  if (isAuthenticated) {
    return <Navigate to="/unified-dashboard" replace />;
  }
  
  // If user is not authenticated, redirect to auth page
  return <Navigate to="/auth" replace />;
};

export default Index;
