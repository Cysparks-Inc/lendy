import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Plus, 
  Filter, 
  Download, 
  BarChart3, 
  Calendar, 
  DollarSign, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit,
  Trash2,
  Search,
  MoreHorizontal
} from 'lucide-react';
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { DateRangeFilter, DateRange } from '@/components/ui/DateRangeFilter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ExpenseData,
  ExpenseFormData,
  ExpenseFilters,
  ExpenseStats,
  ExpenseCategoryData,
  Priority,
  PaymentMethod,
  ExpenseStatus
} from '@/types/expenses';

const expenseFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  currency: z.string().default('KES'),
  category_id: z.string().min(1, 'Category is required'),
  expense_date: z.string().min(1, 'Expense date is required'),
  due_date: z.string().optional(),
  vendor_name: z.string().optional(),
  vendor_contact: z.string().optional(),
  invoice_number: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  payment_method: z.enum(['cash', 'bank_transfer', 'check', 'mobile_money', 'credit_card', 'debit_card', 'other']).optional(),
  branch_id: z.string().optional(), // Made optional
  department: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

const ExpensesPage: React.FC = () => {
  const { user, userRole } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryData[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      title: '',
      description: '',
      amount: 0,
      currency: 'KES',
      category_id: '',
      expense_date: new Date().toISOString().split('T')[0],
      priority: 'medium',
      tags: [],
    },
  });

  // Check if user is super admin/admin
  useEffect(() => {
    if (userRole && userRole !== 'super_admin' && userRole !== 'admin') {
      toast.error('Access Denied', { description: 'Only Super Admins and Admins can access this page.' });
    }
  }, [userRole]);

  // Fetch initial data
  useEffect(() => {
    if (userRole === 'super_admin' || userRole === 'admin') {
      fetchData();
    }
  }, [userRole]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch expenses (assuming the migration has been run)
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (expensesError) throw expensesError;

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (categoriesError) throw categoriesError;

      // Fetch branches
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');

      if (branchesError) throw branchesError;

      setExpenses(expensesData || []);
      setCategories(categoriesData || []);
      setBranches(branchesData || []);
      
      // Calculate stats
      calculateStats(expensesData || []);
      
    } catch (error: any) {
      toast.error('Failed to fetch data', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (expensesData: ExpenseData[]) => {
    const totalExpenses = expensesData.length;
    const totalAmount = expensesData.reduce((sum, exp) => sum + exp.amount, 0);
    const activeAmount = expensesData
      .filter(exp => exp.status === 'active')
      .reduce((sum, exp) => sum + exp.amount, 0);
    const inactiveAmount = expensesData
      .filter(exp => exp.status === 'inactive')
      .reduce((sum, exp) => sum + exp.amount, 0);

    setStats({
      totalExpenses,
      totalAmount,
      activeAmount,
      inactiveAmount,
      categoryBreakdown: {},
      monthlyTrend: []
    });
  };

  // Filter expenses based on search term and date range
  const filteredExpenses = expenses.filter(expense => {
    // Search filter
    const matchesSearch = !searchTerm || 
      expense.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.priority.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.amount.toString().includes(searchTerm) ||
      // Search by category name
      (() => {
        const category = categories.find(cat => cat.id === expense.category_id);
        return category ? category.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      })();

    // Date range filter
    const matchesDateRange = !dateRange.from || !dateRange.to || 
      (expense.expense_date >= dateRange.from.toISOString().split('T')[0] && 
       expense.expense_date <= dateRange.to.toISOString().split('T')[0]);

    return matchesSearch && matchesDateRange;
  });

  // Export columns configuration
  const exportColumns = [
    { header: 'Title', accessorKey: 'title' as keyof ExpenseData },
    { header: 'Amount (KES)', accessorKey: 'amount' as keyof ExpenseData },
    { header: 'Category', accessorKey: (row: ExpenseData) => {
      const category = categories.find(cat => cat.id === row.category_id);
      return category ? category.name : 'Unknown Category';
    }},
    { header: 'Status', accessorKey: 'status' as keyof ExpenseData },
    { header: 'Date', accessorKey: (row: ExpenseData) => format(new Date(row.expense_date), 'MMM dd, yyyy') },
    { header: 'Vendor', accessorKey: 'vendor_name' as keyof ExpenseData },
    { header: 'Priority', accessorKey: 'priority' as keyof ExpenseData },
    { header: 'Description', accessorKey: 'description' as keyof ExpenseData },
  ];

  // Calculate filtered stats
  const filteredStats = {
    totalExpenses: filteredExpenses.length,
    totalAmount: filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0),
    activeAmount: filteredExpenses
      .filter(exp => exp.status === 'active')
      .reduce((sum, exp) => sum + exp.amount, 0),
    inactiveAmount: filteredExpenses
      .filter(exp => exp.status === 'inactive')
      .reduce((sum, exp) => sum + exp.amount, 0),
  };

  const handleAddExpense = () => {
    setEditingExpense(null);
    form.reset({
      title: '',
      description: '',
      amount: undefined, // Changed from 0 to undefined to avoid validation issues
      currency: 'KES',
      category_id: '',
      expense_date: new Date().toISOString().split('T')[0],
      due_date: undefined, // Changed from empty string to undefined
      vendor_name: '',
      vendor_contact: '',
      invoice_number: '',
      priority: 'medium',
      payment_method: undefined,
      branch_id: '', // Will be converted to null in handleFormSubmit
      department: '',
      tags: [],
      notes: '',
    });
    setExpenseDialogOpen(true);
  };

  const handleEditExpense = (expense: ExpenseData) => {
    setEditingExpense(expense);
    form.reset({
      title: expense.title,
      description: expense.description || '',
      amount: expense.amount,
      currency: expense.currency,
      category_id: expense.category_id,
      expense_date: expense.expense_date,
      due_date: expense.due_date || undefined, // Changed from empty string to undefined
      vendor_name: expense.vendor_name || '',
      vendor_contact: expense.vendor_contact || '',
      invoice_number: expense.invoice_number || '',
      priority: expense.priority,
      payment_method: expense.payment_method || undefined,
      branch_id: expense.branch_id !== null && expense.branch_id !== undefined ? expense.branch_id.toString() : '',
      department: expense.department || '',
      tags: expense.tags || [],
      notes: expense.notes || '',
    });
    setExpenseDialogOpen(true);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', expenseId);

        if (error) throw error;

        toast.success('Expense deleted successfully');
        fetchData();
      } catch (error: any) {
        toast.error('Failed to delete expense', { description: error.message });
      }
    }
  };

  const handleFormSubmit = async (data: ExpenseFormData) => {
    try {
      // Debug: Log the incoming data
      console.log('Form submission data:', data);

      // Validate and sanitize data before submission
      if (!data.amount || data.amount <= 0) {
        toast.error('Amount must be greater than 0');
        return;
      }

      // Convert branch_id from string to UUID or null
      // Convert empty date strings to null for optional date fields
      const sanitizedData = {
        ...data,
        branch_id: data.branch_id && data.branch_id !== '' ? data.branch_id : null,
        due_date: data.due_date && data.due_date !== '' ? data.due_date : null,
        payment_date: data.payment_date && data.payment_date !== '' ? data.payment_date : null
      };

      // Debug: Log the sanitized data
      console.log('Sanitized data:', sanitizedData);

      // Additional validation for branch_id (UUID validation)
      if (data.branch_id && data.branch_id !== '') {
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(data.branch_id)) {
          toast.error('Invalid branch ID format. Please select a valid branch.');
          return;
        }
      }

      // Debug: Check for any string fields that might contain quotes
      const stringFields = ['title', 'description', 'vendor_name', 'vendor_contact', 'invoice_number', 'department', 'notes'];
      for (const field of stringFields) {
        if (sanitizedData[field] && typeof sanitizedData[field] === 'string' && sanitizedData[field].includes("'")) {
          console.warn(`Field ${field} contains single quote:`, sanitizedData[field]);
        }
      }

      // Debug: Check date fields
      console.log('Date fields:', {
        expense_date: sanitizedData.expense_date,
        due_date: sanitizedData.due_date,
        payment_date: sanitizedData.payment_date
      });

      // Additional validation: ensure all fields are properly formatted
      if (typeof sanitizedData.amount !== 'number' || isNaN(sanitizedData.amount)) {
        toast.error('Invalid amount format');
        return;
      }

      // Validate branch_id is a valid UUID string or null
      if (sanitizedData.branch_id !== null && typeof sanitizedData.branch_id !== 'string') {
        toast.error('Invalid branch ID format');
        return;
      }

      // Validate required date field
      if (!sanitizedData.expense_date || sanitizedData.expense_date === '') {
        toast.error('Expense date is required');
        return;
      }

      // Validate date format
      if (sanitizedData.expense_date && !Date.parse(sanitizedData.expense_date)) {
        toast.error('Invalid expense date format');
        return;
      }

      // Validate optional date fields if they have values
      if (sanitizedData.due_date && !Date.parse(sanitizedData.due_date)) {
        toast.error('Invalid due date format');
        return;
      }

      if (sanitizedData.payment_date && !Date.parse(sanitizedData.payment_date)) {
        toast.error('Invalid payment date format');
        return;
      }

      if (editingExpense) {
        // Update existing expense
        const updateData = {
          ...sanitizedData,
          updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('expenses')
          .update(updateData)
          .eq('id', editingExpense.id);

        if (error) throw error;
        toast.success('Expense updated successfully');
      } else {
        // Create new expense
        const insertData = {
          ...sanitizedData,
          created_by: user?.id,
          status: 'active'
        };
        
        const { error } = await supabase
          .from('expenses')
          .insert(insertData);

        if (error) throw error;
        toast.success('Expense created successfully');
      }

      setExpenseDialogOpen(false);
      setEditingExpense(null);
      form.reset();
      fetchData();
    } catch (error: any) {
      console.error('Expense submission error:', error);
      
      // Provide more specific error messages for common issues
      if (error.message && error.message.includes('invalid input syntax for type integer')) {
        toast.error('Invalid data format', { 
          description: 'One of the numeric fields contains invalid data. Please check all fields and try again.' 
        });
      } else if (error.message && error.message.includes('invalid input syntax for type date')) {
        toast.error('Invalid date format', { 
          description: 'One of the date fields contains invalid data. Please check all date fields and try again.' 
        });
      } else {
        toast.error('Failed to save expense', { description: error.message });
      }
    }
  };

  // Access control - super admins and admins can see this page
  if (userRole !== 'super_admin' && userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Access Denied</CardTitle>
            <CardDescription className="text-center">
              Only Super Admins can access the Expenses page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Loading expenses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expenses Management</h1>
          <p className="text-gray-600 mt-2">Manage and track all organizational expenses</p>
        </div>
        <Button onClick={handleAddExpense} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {filteredStats.totalExpenses}
                    {filteredStats.totalExpenses !== stats.totalExpenses && (
                      <span className="text-sm text-gray-500 ml-2">({stats.totalExpenses})</span>
                    )}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900">
                    KES {filteredStats.totalAmount.toLocaleString()}
                    {filteredStats.totalAmount !== stats.totalAmount && (
                      <span className="text-sm text-gray-500 ml-2">(KES {stats.totalAmount.toLocaleString()})</span>
                    )}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">
                    KES {filteredStats.activeAmount.toLocaleString()}
                    {filteredStats.activeAmount !== stats.activeAmount && (
                      <span className="text-sm text-gray-500 ml-2">(KES {stats.activeAmount.toLocaleString()})</span>
                    )}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Inactive</p>
                  <p className="text-2xl font-bold text-gray-600">
                    KES {filteredStats.inactiveAmount.toLocaleString()}
                    {filteredStats.inactiveAmount !== stats.inactiveAmount && (
                      <span className="text-sm text-gray-500 ml-2">(KES {stats.inactiveAmount.toLocaleString()})</span>
                    )}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by title, description, vendor, invoice number, amount, category, status, priority..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <DateRangeFilter
          onDateRangeChange={setDateRange}
          placeholder="Filter by date"
          showPresets={true}
        />
        <ExportDropdown
          data={filteredExpenses}
          columns={exportColumns}
          fileName="expenses-report"
          reportTitle="Expenses Report"
          dateRange={dateRange}
          showDateInTitle={true}
        />
        {(searchTerm || dateRange.from || dateRange.to) && (
          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm('');
              setDateRange({ from: undefined, to: undefined });
            }}
            className="whitespace-nowrap"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Expenses</CardTitle>
          <CardDescription>
            {filteredExpenses.length} expenses found
            {filteredExpenses.length !== expenses.length && ` (filtered from ${expenses.length} total)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      {expenses.length === 0 
                        ? 'No expenses found. Create your first expense to get started.'
                        : 'No expenses match your current filters. Try adjusting your search criteria.'
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((expense) => {
                    const category = categories.find(cat => cat.id === expense.category_id);
                    return (
                      <TableRow key={expense.id}>
                                              <TableCell className="font-medium">{expense.title}</TableCell>
                      <TableCell>KES {expense.amount.toLocaleString()}</TableCell>
                      <TableCell>{category ? category.name : 'Unknown Category'}</TableCell>
                      <TableCell>
                        <Badge variant={
                          expense.priority === 'urgent' ? 'destructive' :
                          expense.priority === 'high' ? 'default' :
                          expense.priority === 'medium' ? 'secondary' : 'outline'
                        }>
                          {expense.priority.charAt(0).toUpperCase() + expense.priority.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          expense.status === 'active' ? 'default' : 'secondary'
                        }>
                          {expense.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(expense.expense_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditExpense(expense)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? 'Edit Expense' : 'Add New Expense'}
            </DialogTitle>
            <DialogDescription>
              {editingExpense ? 'Update the expense details below.' : 'Fill in the expense details below. Expense number will be automatically generated.'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="Expense title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (KES) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || value === '0') {
                              field.onChange(0);
                            } else {
                              field.onChange(parseFloat(value));
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expense_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expense Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="branch_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                                                  <SelectTrigger>
                          <SelectValue placeholder="Select branch (optional)" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Expense description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setExpenseDialogOpen(false);
                    setEditingExpense(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingExpense ? 'Update Expense' : 'Create Expense'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpensesPage;
