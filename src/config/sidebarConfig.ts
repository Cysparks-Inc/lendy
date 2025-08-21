import {
  LayoutDashboard, Users, CreditCard, Search, FileText, Settings, User, Shield, UserCheck,
  UsersRound, Clock, AlertTriangle, Folder, Trash2, Building, Banknote
} from 'lucide-react';
import { NavGroup, UserRole } from '@/types'; // Import our new, robust types

// This is the single source of truth for your application's navigation and security.
export const sidebarConfig: NavGroup[] = [
  {
    label: 'Main Operations',
    // This group is visible to everyone, but its ITEMS have specific permissions.
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard }, // Visible to all
      { title: 'Loan Officer', url: '/loan-officer', icon: UserCheck }, // Visible to all
      { title: 'Members', url: '/members', icon: Users }, // Visible to all
      { title: 'Groups', url: '/groups', icon: UsersRound }, // Visible to all
      { title: 'Loans', url: '/loans', icon: Banknote }, // Visible to all
      { title: 'Search Member', url: '/search-member', icon: Search }, // Visible to all
      { 
        title: 'Master Roll', 
        url: '/master-roll', 
        icon: Folder,
        // ITEM-LEVEL SECURITY: Only these roles can see this link.
        requiredRoles: ['super_admin', 'branch_manager'] 
      },
    ],
  },
  {
    label: 'Reports & Analytics',
    // This entire group is restricted.
    requiredRoles: ['super_admin', 'branch_manager'],
    items: [
      { title: 'Daily Overdue', url: '/daily-overdue', icon: Clock },
      { title: 'Realizable Report', url: '/realizable-report', icon: FileText },
      { 
        title: 'Dormant Members', 
        url: '/dormant-members', 
        icon: AlertTriangle,
        // This item is even MORE restricted than its parent group.
        requiredRoles: ['super_admin']
      },
      { 
        title: 'Bad Debt Accounts', 
        url: '/bad-debt', 
        icon: Trash2,
        requiredRoles: ['super_admin']
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      { title: 'Profile', url: '/profile', icon: User }, // Visible to all
      { 
        title: 'Settings', 
        url: '/settings', 
        icon: Settings,
        requiredRoles: ['super_admin'] // Only super admins can see settings
      },
    ],
  },
  {
    label: 'Super Admin',
    // GROUP-LEVEL SECURITY: Only Super Admins can see this entire section.
    requiredRoles: ['super_admin'],
    items: [
      { title: 'Users Management', url: '/users', icon: Users },
      { title: 'Branches', url: '/branches', icon: Building },
      { title: 'Security', url: '/security', icon: Shield },
    ],
  },
];