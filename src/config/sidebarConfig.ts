import {
  LayoutDashboard, Users, CreditCard, Search, FileText, Settings, User, Shield, UserCheck,
  UsersRound, Clock, AlertTriangle, Trash2, Building, Banknote, Receipt, DollarSign,
  Bell, HandCoins, TrendingUp, BarChart3
} from 'lucide-react';
import { NavGroup, UserRole } from '@/types';

// Simple role-based navigation configuration
export const sidebarConfig: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { 
        title: 'Dashboard', 
        url: '/', 
        icon: LayoutDashboard,
        requiredRoles: ['super_admin', 'admin', 'branch_admin', 'loan_officer', 'auditor']
      },
    ],
  },
  {
    label: 'Member Management',
    items: [
      { 
        title: 'Members', 
        url: '/members', 
        icon: Users,
        requiredRoles: ['super_admin', 'admin', 'branch_admin', 'loan_officer', 'auditor']
      },
      { 
        title: 'Loan Officers', 
        url: '/loan-officers', 
        icon: UserCheck,
        requiredRoles: ['super_admin', 'admin']
      },
      { 
        title: 'Search Member', 
        url: '/search-member', 
        icon: Search,
        requiredRoles: ['super_admin', 'admin', 'branch_admin', 'loan_officer', 'auditor']
      },
      { 
        title: 'Groups', 
        url: '/groups', 
        icon: UsersRound,
        requiredRoles: ['super_admin', 'admin', 'branch_admin', 'loan_officer', 'auditor']
      },
    ],
  },
  {
    label: 'Loan Operations',
    items: [
      { 
        title: 'Loans', 
        url: '/loans', 
        icon: Banknote,
        requiredRoles: ['super_admin', 'admin', 'branch_admin', 'loan_officer', 'auditor']
      },
      { 
        title: 'New Loan Application', 
        url: '/loans/new', 
        icon: CreditCard,
        requiredRoles: ['super_admin', 'admin', 'branch_admin', 'loan_officer']
      },
      { 
        title: 'Receive Payments', 
        url: '/receive-payments', 
        icon: HandCoins,
        requiredRoles: ['super_admin', 'admin', 'branch_admin', 'loan_officer']
      },
      { 
        title: 'Loans Overdue', 
        url: '/daily-overdue', 
        icon: AlertTriangle,
        requiredRoles: ['super_admin', 'branch_admin', 'loan_officer', 'auditor']
      },
      { 
        title: 'Loan Approvals', 
        url: '/loans/approvals', 
        icon: Shield,
        requiredRoles: ['super_admin', 'admin', 'branch_admin']
      },
     
    ],
  },
  {
    label: 'Financial Management',
    items: [
      { 
        title: 'Transactions', 
        url: '/transactions', 
        icon: Receipt,
        requiredRoles: ['super_admin', 'admin', 'branch_admin', 'loan_officer', 'auditor']
      },
      { 
        title: 'Expenses', 
        url: '/expenses', 
        icon: DollarSign,
        requiredRoles: ['super_admin', 'admin', 'branch_admin', 'auditor']
      },
      { 
        title: 'Income', 
        url: '/income', 
        icon: TrendingUp,
        requiredRoles: ['super_admin', 'admin', 'branch_admin', 'auditor']
      },
    ],
  },
  {
    label: 'Reports & Analytics',
    items: [
      { 
        title: 'Realizable Report', 
        url: '/realizable-report', 
        icon: BarChart3,
        requiredRoles: ['super_admin', 'branch_admin', 'auditor']
      },
      { 
        title: 'Dormant Members', 
        url: '/dormant-members', 
        icon: AlertTriangle,
        requiredRoles: ['super_admin', 'branch_admin', 'auditor']
      },
      { 
        title: 'Bad Debt Accounts', 
        url: '/bad-debt', 
        icon: Trash2,
        requiredRoles: ['super_admin', 'admin', 'auditor']
      },
    ],
  },
  {
    label: 'System Administration',
    items: [
      { 
        title: 'Users Management', 
        url: '/users', 
        icon: Users,
        requiredRoles: ['super_admin', 'admin']
      },
      { 
        title: 'Branches', 
        url: '/branches', 
        icon: Building,
        requiredRoles: ['super_admin', 'admin', 'auditor']
      },
      {
        title: 'Activity Logs',
        url: '/activity-logs',
        icon: Clock,
        requiredRoles: ['super_admin']
      },
      {
        title: 'Backups',
        url: '/backups',
        icon: FileText,
        requiredRoles: ['super_admin','admin']
      },
    ],
  },
  {
    label: 'User & Settings',
    items: [
      { 
        title: 'Profile', 
        url: '/profile', 
        icon: User,
        requiredRoles: ['super_admin', 'admin', 'branch_admin', 'loan_officer', 'auditor']
      },
      { 
        title: 'Loan Officer', 
        url: '/loan-officer', 
        icon: UserCheck,
        requiredRoles: ['loan_officer']
      },
      { 
        title: 'Notifications', 
        url: '/notifications', 
        icon: Bell,
        requiredRoles: ['super_admin', 'admin', 'branch_admin', 'loan_officer', 'auditor']
      },
      { 
        title: 'Security', 
        url: '/security', 
        icon: Shield,
        requiredRoles: ['super_admin', 'admin', 'branch_admin', 'loan_officer', 'auditor']
      },
      { 
        title: 'Settings', 
        url: '/settings', 
        icon: Settings,
        requiredRoles: ['super_admin', 'admin']
      },
    ],
  },
];