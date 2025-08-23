import {
  LayoutDashboard, Users, CreditCard, Search, FileText, Settings, User, Shield, UserCheck,
  UsersRound, Clock, AlertTriangle, Folder, Trash2, Building, Banknote
} from 'lucide-react';
import { NavGroup, UserRole } from '@/types'; // Import our new, robust types

// This is the single source of truth for your application's navigation and security.
export const sidebarConfig: NavGroup[] = [
  {
    label: 'Main Operations',
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard }, // All roles
      { title: 'Members', url: '/members', icon: Users }, // All roles
      { title: 'Loans', url: '/loans', icon: Banknote }, // All roles
      { title: 'Search Member', url: '/search-member', icon: Search }, // All roles
      { 
        title: 'Groups', 
        url: '/groups', 
        icon: UsersRound,
        requiredRoles: ['super_admin'] // Only super admin can manage groups
      },
      { 
        title: 'Master Roll', 
        url: '/master-roll', 
        icon: Folder,
        requiredRoles: ['super_admin', 'branch_admin', 'loan_officer', 'teller', 'auditor'] // All roles except basic users
      },
    ],
  },
  {
    label: 'Reports & Analytics',
    requiredRoles: ['super_admin', 'branch_admin', 'loan_officer', 'auditor'],
    items: [
      { 
        title: 'Daily Overdue', 
        url: '/daily-overdue', 
        icon: Clock,
        requiredRoles: ['super_admin', 'branch_admin', 'loan_officer', 'auditor']
      },
      { 
        title: 'Realizable Report', 
        url: '/realizable-report', 
        icon: FileText,
        requiredRoles: ['super_admin'] // Only super admin
      },
      { 
        title: 'Dormant Members', 
        url: '/dormant-members', 
        icon: AlertTriangle,
        requiredRoles: ['super_admin', 'branch_admin']
      },
      { 
        title: 'Bad Debt Accounts', 
        url: '/bad-debt', 
        icon: Trash2,
        requiredRoles: ['super_admin', 'branch_admin']
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      { title: 'Profile', url: '/profile', icon: User }, // All roles
      { title: 'Loan Officer', url: '/loan-officer', icon: UserCheck }, // All roles
      { 
        title: 'Settings', 
        url: '/settings', 
        icon: Settings,
        requiredRoles: ['super_admin', 'branch_admin'] // Admin roles only
      },
    ],
  },
  {
    label: 'Super Admin',
    requiredRoles: ['super_admin'],
    items: [
      { title: 'Users Management', url: '/users', icon: Users },
      { title: 'Branches', url: '/branches', icon: Building },
      { title: 'Security', url: '/security', icon: Shield },
    ],
  },
];