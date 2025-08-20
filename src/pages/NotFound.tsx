import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
      <div className="text-center space-y-8 max-w-md mx-auto px-6">
        <div className="space-y-4">
          <div className="relative">
            <div className="text-8xl font-bold text-primary/20 select-none">404</div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Search className="h-16 w-16 text-primary/40" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Page Not Found</h1>
          <p className="text-muted-foreground leading-relaxed">
            The page you're looking for doesn't exist or has been moved. 
            Let's get you back to where you need to be.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="default" className="gap-2">
            <Link to="/">
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2" onClick={() => window.history.back()}>
            <button>
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </Button>
        </div>
        
        <div className="pt-8 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            If you believe this is an error, please contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
