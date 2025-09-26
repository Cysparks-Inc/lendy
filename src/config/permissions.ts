// Comprehensive permissions configuration for granular access control
export const PERMISSIONS = {
  // User Management
  'users.view': 'View Users',
  'users.create': 'Create Users',
  'users.edit': 'Edit Users',
  'users.delete': 'Delete Users',
  'users.manage_permissions': 'Manage User Permissions',
  'users.activate': 'Activate/Deactivate Users',

  // Member Management
  'members.view': 'View Members',
  'members.create': 'Create Members',
  'members.edit': 'Edit Members',
  'members.delete': 'Delete Members',
  'members.search': 'Search Members',
  'groups.view': 'View Groups',
  'groups.create': 'Create Groups',
  'groups.edit': 'Edit Groups',
  'groups.delete': 'Delete Groups',
  'groups.activate': 'Activate/Deactivate Groups',

  // Loan Operations
  'loans.view': 'View Loans',
  'loans.create': 'Create New Loan Application',
  'loans.edit': 'Edit Loans',
  'loans.delete': 'Delete Loans',
  'loans.approve': 'Approve Loans',
  'loans.receive_payments': 'Receive Loan Payments',
  'loans.view_overdue': 'View Overdue Loans',
  'loans.write_off': 'Write Off Loans',
  'loans.bulk_payment': 'Bulk Payment Processing',

  // Financial Management
  'transactions.view': 'View Transactions',
  'expenses.view': 'View Expenses',
  'expenses.create': 'Create Expenses',
  'expenses.edit': 'Edit Expenses',
  'expenses.delete': 'Delete Expenses',
  'income.view': 'View Income',
  'income.create': 'Create Income',
  'income.edit': 'Edit Income',

  // Reports & Analytics
  'reports.view.realizable': 'View Realizable Report',
  'reports.view.dormant': 'View Dormant Members Report',
  'reports.view.bad_debt': 'View Bad Debt Report',
  'reports.export': 'Export Reports',
  'dashboard.view': 'View Dashboard',
  'analytics.view': 'View Analytics',

  // System Administration
  'branches.view': 'View Branches',
  'branches.create': 'Create Branches',
  'branches.edit': 'Edit Branches',
  'branches.delete': 'Delete Branches',
  'branches.activate': 'Activate/Deactivate Branches',
  'settings.view': 'View Settings',
  'settings.edit': 'Edit Settings',
  'security.view': 'View Security Settings',
  'security.edit': 'Edit Security Settings',

  // Communication & Notifications
  'notifications.view': 'View Notifications',
  'communications.log': 'Log Communications',
  'communications.view': 'View Communication Logs',

  // Profile Management
  'profile.view': 'View Own Profile',
  'profile.edit': 'Edit Own Profile',
  'loan_officer.view': 'View Loan Officer Profile',
} as const;

export type Permission = keyof typeof PERMISSIONS;

// Group permissions by category for better UI organization
export const PERMISSION_GROUPS = {
  users: {
    label: 'User Management',
    permissions: [
      'users.view',
      'users.create', 
      'users.edit',
      'users.delete',
      'users.manage_permissions',
      'users.activate'
    ] as Permission[]
  },
  members: {
    label: 'Member Management',
    permissions: [
      'members.view',
      'members.create',
      'members.edit', 
      'members.delete',
      'members.search'
    ] as Permission[]
  },
  groups: {
    label: 'Group Management',
    permissions: [
      'groups.view',
      'groups.create',
      'groups.edit',
      'groups.delete',
      'groups.activate'
    ] as Permission[]
  },
  loans: {
    label: 'Loan Operations',
    permissions: [
      'loans.view',
      'loans.create',
      'loans.edit',
      'loans.delete',
      'loans.approve',
      'loans.receive_payments',
      'loans.view_overdue',
      'loans.write_off',
      'loans.bulk_payment'
    ] as Permission[]
  },
  financial: {
    label: 'Financial Management',
    permissions: [
      'transactions.view',
      'expenses.view',
      'expenses.create',
      'expenses.edit',
      'expenses.delete',
      'income.view',
      'income.create',
      'income.edit'
    ] as Permission[]
  },
  reports: {
    label: 'Reports & Analytics',
    permissions: [
      'reports.view.realizable',
      'reports.view.dormant',
      'reports.view.bad_debt',
      'reports.export',
      'dashboard.view',
      'analytics.view'
    ] as Permission[]
  },
  administration: {
    label: 'System Administration',
    permissions: [
      'branches.view',
      'branches.create',
      'branches.edit',
      'branches.delete',
      'branches.activate',
      'settings.view',
      'settings.edit',
      'security.view',
      'security.edit'
    ] as Permission[]
  },
  communication: {
    label: 'Communication',
    permissions: [
      'notifications.view',
      'communications.log',
      'communications.view'
    ] as Permission[]
  },
  profile: {
    label: 'Profile',
    permissions: [
      'profile.view',
      'profile.edit',
      'loan_officer.view'
    ] as Permission[]
  }
} as const;

export type PermissionGroup = keyof typeof PERMISSION_GROUPS;