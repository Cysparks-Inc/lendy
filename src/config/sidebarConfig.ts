import {
  LayoutDashboard, Users, CreditCard, Search, FileText, Settings, User, Shield, UserCheck,
  UsersRound, Clock, AlertTriangle, Trash2, Building, Banknote, Receipt, DollarSign,
  Bell, HandCoins, TrendingUp, BarChart3
} from 'lucide-react';
import { NavGroup, UserRole } from '@/types';
import { Permission } from '@/config/permissions';

// Permission-based navigation configuration
export const sidebarConfig: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { 
        title: 'Dashboard', 
        url: '/', 
        icon: LayoutDashboard,
        requiredPermission: 'dashboard.view' as Permission
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
        requiredPermission: 'members.view' as Permission
      },
      { 
        title: 'Search Member', 
        url: '/search-member', 
        icon: Search,
        requiredPermission: 'members.search' as Permission
      },
      { 
        title: 'Groups', 
        url: '/groups', 
        icon: UsersRound,
        requiredPermission: 'groups.view' as Permission
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
        requiredPermission: 'loans.view' as Permission
      },
      { 
        title: 'New Loan Application', 
        url: '/loans/new', 
        icon: CreditCard,
        requiredPermission: 'loans.create' as Permission
      },
      { 
        title: 'Receive Payments', 
        url: '/receive-payments', 
        icon: HandCoins,
        requiredPermission: 'loans.receive_payments' as Permission
      },
      { 
        title: 'Loans Overdue', 
        url: '/daily-overdue', 
        icon: AlertTriangle,
        requiredPermission: 'loans.view_overdue' as Permission
      },
      { 
        title: 'Loan Approvals', 
        url: '/loans/approvals', 
        icon: Shield,
        requiredPermission: 'loans.approve' as Permission
      },
      { 
        title: 'Bulk Payment', 
        url: '/bulk-payment', 
        icon: HandCoins,
        requiredPermission: 'loans.bulk_payment' as Permission
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
        requiredPermission: 'transactions.view' as Permission
      },
      { 
        title: 'Expenses', 
        url: '/expenses', 
        icon: DollarSign,
        requiredPermission: 'expenses.view' as Permission
      },
      { 
        title: 'Income', 
        url: '/income', 
        icon: TrendingUp,
        requiredPermission: 'income.view' as Permission
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
        requiredPermission: 'reports.view.realizable' as Permission
      },
      { 
        title: 'Dormant Members', 
        url: '/dormant-members', 
        icon: AlertTriangle,
        requiredPermission: 'reports.view.dormant' as Permission
      },
      { 
        title: 'Bad Debt Accounts', 
        url: '/bad-debt', 
        icon: Trash2,
        requiredPermission: 'reports.view.bad_debt' as Permission
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
        requiredPermission: 'users.view' as Permission
      },
      { 
        title: 'Branches', 
        url: '/branches', 
        icon: Building,
        requiredPermission: 'branches.view' as Permission
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
        requiredPermission: 'profile.view' as Permission
      },
      { 
        title: 'Loan Officer', 
        url: '/loan-officer', 
        icon: UserCheck,
        requiredPermission: 'loan_officer.view' as Permission
      },
      { 
        title: 'Notifications', 
        url: '/notifications', 
        icon: Bell,
        requiredPermission: 'notifications.view' as Permission
      },
      { 
        title: 'Security', 
        url: '/security', 
        icon: Shield,
        requiredPermission: 'security.view' as Permission
      },
      { 
        title: 'Settings', 
        url: '/settings', 
        icon: Settings,
        requiredPermission: 'settings.view' as Permission
      },
    ],
  },
];