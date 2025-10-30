import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { sidebarConfig } from '@/config/sidebarConfig'; // Import only the config
import { NavGroup, UserRole } from '@/types'; // Import types directly

// --- Sub-component for rendering a single navigation group ---
// This promotes composition and keeps the main component clean.

type NavigationGroupProps = {
  group: NavGroup;
  isCollapsed: boolean;
  isActive: (path: string) => boolean;
  getNavClassName: (active: boolean) => string;
  onNavigate: () => void; // Add navigation callback
};

const NavigationGroup: React.FC<NavigationGroupProps> = ({ group, isCollapsed, isActive, getNavClassName, onNavigate }) => (
  <SidebarGroup>
    <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground/80 mb-2">
      {group.label}
    </SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        {group.items.map(item => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild className="mb-1">
              <Link to={item.url} className={getNavClassName(isActive(item.url))} onClick={onNavigate}>
                <item.icon className="h-4 w-4" />
                {!isCollapsed && <span className="font-medium">{item.title}</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
);

// --- Main Sidebar Component ---

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const { user, signOut, userRole, hasPermission } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";

  const isActive = (path: string): boolean => {
    if (path === '/') return currentPath === path;
    return currentPath.startsWith(path);
  };

  const getNavClassName = (active: boolean): string =>
    active ? "bg-brand-blue-600 text-white font-medium shadow-sm" : "hover:bg-brand-blue-50 hover:text-brand-blue-700 transition-all duration-200";

  const handleSignOut = (): void => {
    signOut();
  };

  // Close mobile sidebar when navigation item is clicked
  const handleNavigation = () => {
    // Close mobile sidebar
    setOpenMobile(false);
    // Also collapse sidebar on mobile for better UX
    if (state === "expanded") {
      // Small delay to allow navigation to complete first
      setTimeout(() => {
        // This will trigger the sidebar to collapse on mobile
      }, 100);
    }
  };

  // Filter the navigation groups based on user role
  const visibleNavGroups = sidebarConfig.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // Check if user's role is in the required roles list
      if (item.requiredRoles && userRole) {
        return item.requiredRoles.includes(userRole as UserRole);
      }
      // Default: allow access for authenticated users
      return true;
    })
  })).filter(group => group.items.length > 0); // Only show groups with visible items

  return (
    <Sidebar className={`${isCollapsed ? "w-14" : "w-56"} collapsible="icon"`} style={{ top: '64px', height: 'calc(100vh - 64px)' }}>
      <SidebarHeader className="border-b border-border p-4 bg-gradient-to-br from-brand-blue-50 to-brand-blue-100">
        <div className="flex items-center gap-3">
          <img
            src="/lovable-uploads/logo-napol.png"
            alt="Pett Vision Logo"
            className="w-8 h-8 object-contain flex-shrink-0"
          />
          {!isCollapsed && (
            <div>
              <h2 className="text-xl font-bold text-foreground bg-gradient-to-r from-brand-blue-600 to-brand-blue-800 bg-clip-text text-transparent">
              
              </h2>
              <p className="text-xs text-muted-foreground capitalize font-medium">
                {userRole === 'super_admin' ? 'Super Admin' : userRole} Panel
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {visibleNavGroups.map(group => (
          <NavigationGroup
            key={group.label}
            group={group}
            isCollapsed={isCollapsed}
            isActive={isActive}
            getNavClassName={getNavClassName}
            onNavigate={handleNavigation}
          />
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        {user && (
          isCollapsed ? (
            <Button variant="outline" size="icon" onClick={handleSignOut} className="w-full">
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="text-sm">
                <p className="font-medium text-foreground truncate">{user.email}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full justify-start">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          )
        )}
      </SidebarFooter>
    </Sidebar>
  );
}