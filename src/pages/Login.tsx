
import { Navigate } from 'react-router-dom';

const Login = () => {
  // Redirect to the new Auth page
  return <Navigate to="/auth" replace />;
};

export default Login;
