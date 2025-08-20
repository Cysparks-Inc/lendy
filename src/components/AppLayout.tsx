import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { PageLoader } from '@/components/ui/loader';
import { ProfileDropdown } from '@/components/ProfileDropdown';
const AppLayout = () => {
  const {
    user,
    loading,
    userRole
  } = useAuth();
  if (loading) {
    return <PageLoader />;
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  if (!userRole) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="text-lg font-medium text-foreground">Access Pending</div>
          <p className="text-muted-foreground">
            Your account is pending role assignment. Please contact an administrator.
          </p>
        </div>
      </div>;
  }
  return <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm px-6 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-accent hover:text-accent-foreground transition-colors p-2 h-10 w-10 rounded-md" />
              <div className="flex items-center gap-2">
                <img src="/lovable-uploads/d7fc2e96-c700-49a2-be74-507880e07deb.png" alt="Napol Logo" className="h-10 w-10 md:h-12 md:w-12 object-contain" />
                <h1 className="font-bold text-xl md:text-2xl bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  Napol
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {userRole === 'super_admin' ? 'Super Admin' : userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}
              </span>
              <ProfileDropdown />
            </div>
          </header>
          <main className="flex-1 p-6 bg-background/50">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>;
};
export default AppLayout;