import {
  LayoutDashboard, Users, CreditCard, Search, FileText, Settings, User, Shield, UserCheck,
  UsersRound, Clock, AlertTriangle, Trash2, Building, Banknote, Receipt, DollarSign,
  Bell, HandCoins, TrendingUp, BarChart3
} from 'lucide-react';
import { NavGroup, UserRole } from '@/types'; // Import our new, robust types

// This is the single source of truth for your application's navigation and security.
export const sidebarConfig: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard }, // All roles
    ],
  },
  {
    label: 'Member Management',
    items: [
      { title: 'Members', url: '/members', icon: Users }, // All roles
      { title: 'Search Member', url: '/search-member', icon: Search }, // All roles
      { 
        title: 'Groups', 
        url: '/groups', 
        icon: UsersRound,
        requiredRoles: ['super_admin', 'admin'] // Super admin and admin can manage groups
      },
    ],
  },
  {
    label: 'Loan Operations',
    items: [
      { title: 'Loans', url: '/loans', icon: Banknote }, // All roles
      { title: 'New Loan Application', url: '/loans/new', icon: CreditCard }, // All roles
      { title: 'Receive Payments', url: '/receive-payments', icon: HandCoins }, // All roles
      { title: 'Loans Overdue', url: '/daily-overdue', icon: AlertTriangle }, // All roles
      { 
        title: 'Loan Approvals', 
        url: '/loans/approvals', 
        icon: Shield,
        requiredRoles: ['super_admin', 'admin'] // Admin roles only
      },
    ],
  },
  {
    label: 'Financial Management',
    items: [
      { title: 'Transactions', url: '/transactions', icon: Receipt }, // All roles
      { 
        title: 'Expenses', 
        url: '/expenses', 
        icon: DollarSign,
        requiredRoles: ['super_admin'] // Super admin only
      },
      { 
        title: 'Income', 
        url: '/income', 
        icon: TrendingUp,
        requiredRoles: ['super_admin'] // Super admin only
      },
    ],
  },
  {
    label: 'Reports & Analytics',
    requiredRoles: ['super_admin', 'admin', 'branch_admin', 'loan_officer', 'auditor'],
    items: [
      { 
        title: 'Realizable Report', 
        url: '/realizable-report', 
        icon: BarChart3,
        requiredRoles: ['super_admin', 'admin'] // Super admin and admin
      },
      { 
        title: 'Dormant Members', 
        url: '/dormant-members', 
        icon: AlertTriangle,
        requiredRoles: ['super_admin', 'admin', 'branch_admin']
      },
      { 
        title: 'Bad Debt Accounts', 
        url: '/bad-debt', 
        icon: Trash2,
        requiredRoles: ['super_admin', 'admin', 'branch_admin']
      },
    ],
  },
  {
    label: 'System Administration',
    requiredRoles: ['super_admin'],
    items: [
      { title: 'Users Management', url: '/users', icon: Users },
      { title: 'Branches', url: '/branches', icon: Building },
      { title: 'Security', url: '/security', icon: Shield },
    ],
  },
  {
    label: 'User & Settings',
    items: [
      { title: 'Profile', url: '/profile', icon: User }, // All roles
      { title: 'Loan Officer', url: '/loan-officer', icon: UserCheck }, // All roles
      { title: 'Notifications', url: '/notifications', icon: Bell }, // All roles
      { 
        title: 'Settings', 
        url: '/settings', 
        icon: Settings,
        requiredRoles: ['super_admin', 'admin', 'branch_admin'] // Admin roles only
      },
    ],
  },
];