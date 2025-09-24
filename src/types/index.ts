// This file will hold all common types for your application.

// Definitive list of user roles in the system.
// Using a type ensures you can't make a typo anywhere in the app.
export type UserRole = 'super_admin' | 'admin' | 'branch_admin' | 'loan_officer' | 'teller' | 'auditor';

// The new, more robust structure for a navigation item.
// It can now have its own list of required roles.
export type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  requiredRoles?: UserRole[]; // Optional array of roles
};

// The new structure for a navigation group.
export type NavGroup = {
  label: string;
  items: NavItem[];
  requiredRoles?: UserRole[]; // Optional array of roles
};

// Additional types to fix build errors
export interface BadDebtStats {
  totalWrittenOff: number;
  totalValue: number;
  recovery_rate?: number;
}

// Re-export types from the expenses module
export * from './expenses';