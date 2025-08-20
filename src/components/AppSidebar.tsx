import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, Search, FileText, Settings, LogOut, User, Shield, UserCheck, UsersRound, Clock, AlertTriangle, Folder, Trash2 } from 'lucide-react';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
const mainNavItems = [{
  title: 'Dashboard',
  url: '/',
  icon: LayoutDashboard
}, {
  title: 'Loan Officer',
  url: '/loan-officer',
  icon: UserCheck
}, {
  title: 'Master Roll',
  url: '/master-roll',
  icon: Folder
}, {
  title: 'Groups',
  url: '/groups',
  icon: UsersRound
}, {
  title: 'Members',
  url: '/members',
  icon: Users
}, {
  title: 'Search Member',
  url: '/search-member',
  icon: Search
}, {
  title: 'Loan Accounts',
  url: '/loan-accounts',
  icon: CreditCard
}];
const reportsNavItems = [{
  title: 'Daily Overdue Report',
  url: '/daily-overdue',
  icon: Clock
}, {
  title: 'Realizable Report',
  url: '/realizable-report',
  icon: FileText
}, {
  title: 'Dormant Members',
  url: '/dormant-members',
  icon: AlertTriangle
}, {
  title: 'Bad Debt Accounts',
  url: '/bad-debt',
  icon: Trash2
}];
const adminNavItems = [{
  title: 'Profile',
  url: '/profile',
  icon: User
}, {
  title: 'Settings',
  url: '/settings',
  icon: Settings
}];
const superAdminNavItems = [{
  title: 'Users Management',
  url: '/users',
  icon: Users
}, {
  title: 'Security',
  url: '/security',
  icon: Shield
}];
export function AppSidebar() {
  const {
    state
  } = useSidebar();
  const {
    user,
    signOut,
    isSuperAdmin,
    userRole
  } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";
  
  const isActive = (path: string) => {
    if (path === '/') {
      return currentPath === path;
    }
    return currentPath.startsWith(path);
  };
  const getNavClassName = (active: boolean) => active ? "bg-primary text-primary-foreground font-medium shadow-sm" : "hover:bg-accent hover:text-accent-foreground transition-all duration-200";
  const handleSignOut = () => {
    signOut();
  };
  return <Sidebar className={isCollapsed ? "w-14" : "w-56"} collapsible="icon">
      <SidebarHeader className="border-b border-border p-4 bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden bg-white shadow-sm">
            <img src="/lovable-uploads/d7fc2e96-c700-49a2-be74-507880e07deb.png" alt="Napol Logo" className="h-8 w-8 object-contain" />
          </div>
          {!isCollapsed && <div>
              <h2 className="text-xl font-bold text-foreground bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                Napol
              </h2>
              <p className="text-xs text-muted-foreground capitalize font-medium">
                {userRole === 'super_admin' ? 'Super Admin' : userRole} Panel
              </p>
            </div>}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground/80 mb-2">
            Main Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="mb-1">
                    <Link to={item.url} className={getNavClassName(isActive(item.url))}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span className="font-medium">{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground/80 mb-2">
            Reports & Analytics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {reportsNavItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="mb-1">
                    <Link to={item.url} className={getNavClassName(isActive(item.url))}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span className="font-medium">{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground/80 mb-2">
            Administration
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="mb-1">
                    <Link to={item.url} className={getNavClassName(isActive(item.url))}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span className="font-medium">{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground/80 mb-2">
              Super Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {superAdminNavItems.map(item => <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className="mb-1">
                      <Link to={item.url} className={getNavClassName(isActive(item.url))}>
                        <item.icon className="h-4 w-4" />
                        {!isCollapsed && <span className="font-medium">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4 w-1/12 ">
        {!isCollapsed && user && <div className="space-y-2">
            <div className="text-sm">
              <p className="font-medium text-foreground">{user.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full justify-start">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>}
        {isCollapsed && user && <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full p-2">
            <LogOut className="h-4 w-4" />
          </Button>}
      </SidebarFooter>
    </Sidebar>;
}