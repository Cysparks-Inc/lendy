import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user } = useAuth();
  
  // Redirect to auth if not logged in, otherwise show dashboard
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <Navigate to="/" replace />;
};

export default Index;
