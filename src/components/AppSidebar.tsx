import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { sidebarConfig, NavGroup } from '@/config/sidebarConfig'; // Import our new typed config

// --- Sub-component for rendering a single navigation group ---
// This promotes composition and keeps the main component clean.

type NavigationGroupProps = {
  group: NavGroup;
  isCollapsed: boolean;
  isActive: (path: string) => boolean;
  getNavClassName: (active: boolean) => string;
};

const NavigationGroup: React.FC<NavigationGroupProps> = ({ group, isCollapsed, isActive, getNavClassName }) => (
  <SidebarGroup>
    <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground/80 mb-2">
      {group.label}
    </SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        {group.items.map(item => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild className="mb-1">
              <Link to={item.url} className={getNavClassName(isActive(item.url))}>
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
  const { state } = useSidebar();
  const { user, signOut, userRole } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";

  const isActive = (path: string): boolean => {
    if (path === '/') return currentPath === path;
    return currentPath.startsWith(path);
  };

  const getNavClassName = (active: boolean): string =>
    active ? "bg-primary text-primary-foreground font-medium shadow-sm" : "hover:bg-accent hover:text-accent-foreground transition-all duration-200";

  const handleSignOut = (): void => {
    signOut();
  };

  // Filter the navigation groups based on the user's role
  const visibleNavGroups = sidebarConfig.filter(group => {
    if (!group.requiredRole) return true; // If no role is required, always show the group
    return group.requiredRole === userRole; // Otherwise, check for a role match
  });

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-56"} collapsible="icon">
      <SidebarHeader className="border-b border-border p-4 bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden bg-white shadow-sm">
            <img src="/lovable-uploads/d7fc2e96-c700-49a2-be74-507880e07deb.png" alt="Napol Logo" className="h-8 w-8 object-contain" />
          </div>
          {!isCollapsed && (
            <div>
              <h2 className="text-xl font-bold text-foreground bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                Napol
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