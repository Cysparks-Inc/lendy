import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { PageLoader } from '@/components/ui/loader';
import { ProfileDropdown } from '@/components/ProfileDropdown';

const AppLayout = () => {
  const { user, loading, userRole } = useAuth();

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
          <header className="h-16 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm px-6 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-accent hover:text-accent-foreground transition-colors p-2 h-10 w-10 rounded-md" />
              
              <div className="flex items-center gap-2">
                <img 
                  src="/lovable-uploads/d7fc2e96-c700-49a2-be74-507880e07deb.png" 
                  alt="Napol Logo" 
                  className="h-10 w-20 md:h-12 md:w-12 object-contain" 
                />
                <h1 className="font-bold text-xl md:text-2xl bg-gradient-to-r from-brand-green-600 to-brand-green-700 bg-clip-text text-transparent">
                  Napol Microfinace
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {formatRoleDisplay(userRole)}
              </span>
              <ProfileDropdown />
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-2 sm:p-4 md:p-6 bg-background/50 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;