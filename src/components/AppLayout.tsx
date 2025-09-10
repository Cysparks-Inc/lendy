import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { PageLoader } from '@/components/ui/loader';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import Notifications from '@/components/Notifications';
import { useEffect, useRef } from 'react';

const AppLayout = () => {
  const { user, loading, userRole } = useAuth();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Scroll to top when location changes
  useEffect(() => {
    // Scroll main content to top
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    // Also scroll window to top for mobile
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Show loading state while authentication is being determined
  if (loading) {
    return <PageLoader />;
  }

  // Redirect unauthenticated users to login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Note: We don't block users based on role here - that's handled at the route/component level

  const formatRoleDisplay = (role) => {
    const roleMap = {
      'super_admin': 'Super Admin',
      'branch_admin': 'Branch Admin',
      'loan_officer': 'Loan Officer',
      'staff': 'Staff'
    };
    return roleMap[role] || role?.charAt(0).toUpperCase() + role?.slice(1) || 'User';
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-16 flex items-center justify-between border-b border-border bg-white/95 backdrop-blur-md px-4 sm:px-6 fixed top-0 left-0 right-0 z-50 shadow-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="hover:bg-accent hover:text-accent-foreground transition-colors p-2 h-10 w-10 rounded-md" />
              <div className="flex items-center gap-2">
                <img
                  src="/lovable-uploads/logo-napol.png"
                  alt="Napol Logo"
                  className="w-8 h-8 object-contain"
                />
                <h1 className="font-bold text-lg sm:text-xl md:text-2xl bg-gradient-to-r from-brand-green-600 to-brand-green-800 bg-clip-text text-transparent whitespace-nowrap">
                  Napol Microfinance
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                 {formatRoleDisplay(userRole)}
               </span>
              <Notifications />
              <ProfileDropdown />
            </div>
          </header>

          {/* Main Content - Ensure top is visible first */}
          <main ref={mainRef} className="flex-1 p-2 sm:p-4 md:p-6 bg-background/50 overflow-x-hidden mt-20">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;