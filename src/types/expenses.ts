// Expense Management System Types

export type ExpenseCategory = 
  | 'office_supplies'
  | 'utilities'
  | 'rent'
  | 'salaries'
  | 'marketing'
  | 'travel'
  | 'equipment'
  | 'maintenance'
  | 'insurance'
  | 'legal_fees'
  | 'consulting'
  | 'training'
  | 'software'
  | 'hardware'
  | 'communications'
  | 'transportation'
  | 'meals'
  | 'entertainment'
  | 'other';

export type ExpenseStatus = 
  | 'active'
  | 'inactive';

export type PaymentMethod = 
  | 'cash'
  | 'bank_transfer'
  | 'check'
  | 'mobile_money'
  | 'credit_card'
  | 'debit_card'
  | 'other';

-- Approval level type removed - not needed for simplified expense system

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type ReportType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface ExpenseCategoryData {
  id: string;
  name: string;
  code: string;
  description?: string;
  budget_limit?: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseData {
  id: string;
  expense_number: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  category_id: string;
  expense_date: string;
  due_date?: string;
  vendor_name?: string;
  vendor_contact?: string;
  invoice_number?: string;
  receipt_url?: string;
  status: ExpenseStatus;
  priority: Priority;
  payment_method?: PaymentMethod;
  payment_date?: string;
  -- Approval fields removed - not needed for simplified expense system
  branch_id?: string;
  department?: string;
  tags?: string[];
  attachments?: any[];
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

-- Expense approval interface removed - not needed for simplified expense system

export interface ExpenseBudgetData {
  id: string;
  category_id: string;
  branch_id?: string;
  year: number;
  month?: number;
  budget_amount: number;
  spent_amount: number;
  remaining_amount: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseReportData {
  id: string;
  report_name: string;
  report_type: ReportType;
  parameters: Record<string, any>;
  last_generated?: string;
  next_generation?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface ExpenseFormData {
  title: string;
  description?: string;
  amount: number;
  currency: string;
  category_id: string;
  expense_date: string;
  due_date?: string;
  vendor_name?: string;
  vendor_contact?: string;
  invoice_number?: string;
  priority: Priority;
  payment_method?: PaymentMethod;
  branch_id?: string;
  department?: string;
  tags?: string[];
  notes?: string;
}

export interface ExpenseFilters {
  status?: ExpenseStatus[];
  category_id?: string[];
  branch_id?: string[];
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  priority?: Priority[];
  created_by?: string[];
  search?: string;
}

export interface ExpenseStats {
  total_expenses: number;
  total_amount: number;
  pending_amount: number;
  approved_amount: number;
  paid_amount: number;
  rejected_amount: number;
  category_breakdown: Array<{
    category_name: string;
    amount: number;
    count: number;
  }>;
  monthly_trend: Array<{
    month: string;
    amount: number;
    count: number;
  }>;
  status_distribution: Array<{
    status: ExpenseStatus;
    count: number;
    amount: number;
  }>;
}

export interface BudgetOverview {
  total_budget: number;
  total_spent: number;
  total_remaining: number;
  utilization_percentage: number;
  category_budgets: Array<{
    category_name: string;
    budget_amount: number;
    spent_amount: number;
    remaining_amount: number;
    utilization_percentage: number;
  }>;
  monthly_budgets: Array<{
    month: string;
    budget_amount: number;
    spent_amount: number;
    remaining_amount: number;
  }>;
}

export interface ExpenseExportOptions {
  format: 'csv' | 'pdf' | 'excel';
  date_range: 'all' | 'this_month' | 'this_quarter' | 'this_year' | 'custom';
  custom_date_from?: string;
  custom_date_to?: string;
  include_columns: string[];
  filters?: ExpenseFilters;
}
