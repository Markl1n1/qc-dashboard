
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const Login = () => {
  const { isAuthenticated } = useAuthStore();
  
  // If user is already authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  // Redirect to the auth page for login
  return <Navigate to="/auth" replace />;
};

export default Login;
