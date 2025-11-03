import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Calendar, 
  DollarSign, 
  User, 
  Building,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Banknote,
  Wallet,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { PageLoader, InlineLoader, QuickLoader } from '@/components/ui/loader';
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/ui/data-table';
import { Link } from 'react-router-dom';
import { DateRangeFilter, DateRange, filterDataByDateRange } from '@/components/ui/DateRangeFilter';

// Types
interface Transaction {
  id: string;
  transaction_type: 'payment' | 'disbursement' | 'refund' | 'fee' | 'penalty' | 'adjustment';
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'cancelled';
  payment_method: 'cash' | 'bank_transfer' | 'mobile_money' | 'check' | 'other';
  reference_number: string;
  description: string;
  transaction_date: string;
  created_at: string;
  updated_at: string;
  
  // Related entities
  loan_id?: string;
  member_id?: string;
  loan_account_number?: string;
  member_name?: string;
  branch_id?: number;
  branch_name?: string;
  group_id?: string;
  group_name?: string;
  loan_officer_id?: string;
  loan_officer_name?: string;
  
  // Additional details
  fees?: number;
  penalties?: number;
  principal_paid?: number;
  interest_paid?: number;
  total_paid?: number;
  balance_before?: number;
  balance_after?: number;
  
  // Metadata
  notes?: string;
  receipt_url?: string;
  created_by?: string;
  created_by_name?: string;
}

interface TransactionFilters {
  search: string;
  transaction_type: string;
  status: string;
  payment_method: string;
  branch_id: string;
  loan_officer_id: string;
  group_id: string;
}

// Helper functions for badge variants
const getTransactionTypeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (type) {
    case 'payment':
      return 'default';
    case 'disbursement':
      return 'secondary';
    case 'refund':
      return 'outline';
    case 'fee':
    case 'penalty':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'completed':
      return 'default';
    case 'pending':
      return 'outline';
    case 'failed':
    case 'cancelled':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const Transactions: React.FC = () => {
  const { user, userRole, profile } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]); // Store all fetched transactions
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [loanOfficers, setLoanOfficers] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState<TransactionFilters>({
    search: '',
    transaction_type: 'all',
    status: 'all',
    payment_method: 'all',
    branch_id: 'all',
    loan_officer_id: 'all',
    group_id: 'all'
  });
  const [groups, setGroups] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const itemsPerPage = 20;

  // Fetch all transactions (only on initial load or refresh)
  const fetchTransactions = async (skipLoading = false) => {
    try {
      if (!skipLoading) {
        setLoading(true);
      }
      
      // Fetch all transactions without pagination or complex filters
      // We'll do filtering client-side for better performance and real-time updates
      let query = supabase
        .from('loan_payments')
        .select('*')
        .order('payment_date', { ascending: false });

      // Apply only basic role-based filtering
      if (userRole === 'branch_admin' && profile?.branch_id) {
        // We'll filter by branch after fetching loans
      }

      // Fetch all data (we'll filter client-side)
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching transactions:', error);
        toast.error('Failed to fetch transactions');
        return;
      }

      if (!data || data.length === 0) {
        setAllTransactions([]);
        setTransactions([]);
        setTotalTransactions(0);
        setTotalPages(1);
        if (!skipLoading) setLoading(false);
        return;
      }

      // Fetch related data separately to avoid relationship issues
      const loanIds = [...new Set(data.map(tx => tx.loan_id).filter(Boolean))];
      
      // First fetch loans to get member_id and branch_id
      const loansRes = loanIds.length > 0 
        ? await supabase.from('loans').select('id, application_no, member_id, branch_id, loan_officer_id').in('id', loanIds)
        : { data: [], error: null };

      if (loansRes.error) throw loansRes.error;

      // Extract member_ids from loans
      const memberIds = [...new Set((loansRes.data || []).map(loan => loan.member_id).filter(Boolean))];
      
      // Extract branch_ids from loans
      const branchIds = [...new Set((loansRes.data || []).map(loan => loan.branch_id).filter(Boolean))];

      const [membersRes, branchesRes] = await Promise.all([
        memberIds.length > 0 ? supabase.from('members').select('id, first_name, last_name, phone_number, id_number, assigned_officer_id, group_id').in('id', memberIds) : { data: [], error: null },
        branchIds.length > 0 ? supabase.from('branches').select('id, name').in('id', branchIds) : { data: [], error: null }
      ]);

      // Fetch groups for members
      const groupIds = [...new Set((membersRes.data || []).map((m: any) => m.group_id).filter(Boolean))];
      const groupsRes = groupIds.length > 0 
        ? await supabase.from('groups').select('id, name').in('id', groupIds)
        : { data: [], error: null };

      // Fetch loan officers for loans
      const loanOfficerIds = [...new Set((loansRes.data || []).map(loan => loan.loan_officer_id).filter(Boolean))];
      const loanOfficersRes = loanOfficerIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', loanOfficerIds)
        : { data: [], error: null };

      // Also get assigned officers from members
      const assignedOfficerIds = [...new Set((membersRes.data || []).map((m: any) => m.assigned_officer_id).filter(Boolean))];
      const assignedOfficersRes = assignedOfficerIds.length > 0 && assignedOfficerIds.some(id => !loanOfficerIds.includes(id))
        ? await supabase.from('profiles').select('id, full_name').in('id', assignedOfficerIds.filter(id => !loanOfficerIds.includes(id)))
        : { data: [], error: null };

      // Combine all loan officers
      const allLoanOfficers = [
        ...(loanOfficersRes.data || []),
        ...(assignedOfficersRes.data || [])
      ];

      // Create lookup maps
      const loansMap = new Map((loansRes.data || []).map(loan => [loan.id, loan]));
      const membersMap = new Map((membersRes.data || []).map((member: any) => {
        const fullName = member?.first_name && member?.last_name 
          ? `${member.first_name} ${member.last_name}`.trim()
          : member?.first_name || member?.last_name || 'Unknown Member';
        return [member.id, { ...member, full_name: fullName }];
      }));
      const branchesMap = new Map((branchesRes.data || []).map(branch => [branch.id, branch]));
      const groupsMap = new Map((groupsRes.data || []).map(group => [group.id, group]));
      const loanOfficersMap = new Map(allLoanOfficers.map(officer => [officer.id, officer.full_name]));

      // Transform data to match our interface
      let transformedTransactions: Transaction[] = data.map(tx => {
        const loan = loansMap.get(tx.loan_id);
        // Get member_id from loan, not from the payment record
        const member = loan?.member_id ? membersMap.get(loan.member_id) : null;
        const branch = loan?.branch_id ? branchesMap.get(loan.branch_id) : null;
        const group = member?.group_id ? groupsMap.get(member.group_id) : null;

        // Map loan_payments fields to transaction interface
        const paymentDate = tx.payment_date || tx.created_at || new Date().toISOString();
        
        return {
          id: tx.id,
          transaction_type: tx.payment_type || 'payment',
          amount: tx.amount,
          currency: tx.currency || 'KES',
          status: tx.status || 'completed',
          payment_method: tx.payment_method || 'cash',
          reference_number: tx.reference_number || `LP-${tx.id.slice(0, 8)}`,
          description: tx.notes || 'Payment received',
          transaction_date: paymentDate,
          created_at: tx.created_at,
          updated_at: tx.updated_at,
          
          // Related entities
          loan_id: tx.loan_id,
          member_id: loan?.member_id,
          loan_account_number: loan?.application_no || 'N/A',
          member_name: member?.full_name || 'Unknown Member',
          branch_id: loan?.branch_id,
          branch_name: branch?.name,
          group_id: member?.group_id,
          group_name: group?.name,
          loan_officer_id: loan?.loan_officer_id || (member as any)?.assigned_officer_id || null,
          loan_officer_name: (() => {
            const officerId = loan?.loan_officer_id || (member as any)?.assigned_officer_id;
            return officerId ? (loanOfficersMap.get(officerId) || 'Unknown Officer') : 'Not assigned';
          })(),
          
          // Additional details
          fees: tx.fees,
          penalties: tx.penalties,
          principal_paid: tx.principal_paid,
          interest_paid: tx.interest_paid,
          total_paid: tx.total_paid,
          balance_before: tx.balance_before,
          balance_after: tx.balance_after,
          
          // Metadata
          notes: tx.notes,
          receipt_url: tx.receipt_url,
          created_by: tx.created_by,
          created_by_name: tx.created_by_name
        };
      });

      // Store all transactions for client-side filtering
      // The useEffect will automatically apply filters when allTransactions changes
      setAllTransactions(transformedTransactions);

    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to fetch transactions');
    } finally {
      if (!skipLoading) {
        setLoading(false);
      }
    }
  };

  // Apply filters to transactions (client-side, instant filtering)
  const applyFiltersToTransactions = useCallback((transactionsToFilter?: Transaction[]) => {
    const source = transactionsToFilter || allTransactions;
    if (source.length === 0) return;
    
    let filtered = [...source];

    // Apply role-based filtering
    if (userRole === 'loan_officer') {
      filtered = filtered.filter(tx => 
        tx.loan_officer_id === user?.id
      );
    }

    // Apply branch admin filtering
    if (userRole === 'branch_admin' && profile?.branch_id) {
      filtered = filtered.filter(tx => 
        tx.branch_id === profile.branch_id
      );
    }

    // Apply transaction type filter
    if (filters.transaction_type !== 'all') {
      filtered = filtered.filter(tx => 
        tx.transaction_type === filters.transaction_type
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(tx => 
        tx.status === filters.status
      );
    }

    // Apply payment method filter
    if (filters.payment_method !== 'all') {
      filtered = filtered.filter(tx => 
        tx.payment_method === filters.payment_method
      );
    }

    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(tx => {
        const txDate = new Date(tx.transaction_date);
        if (dateRange.from && txDate < dateRange.from) return false;
        if (dateRange.to) {
          const toDate = new Date(dateRange.to);
          toDate.setHours(23, 59, 59, 999); // Include the entire end date
          if (txDate > toDate) return false;
        }
        return true;
      });
    }

    // Apply loan officer filter
    if (filters.loan_officer_id !== 'all') {
      filtered = filtered.filter(tx => 
        tx.loan_officer_id === filters.loan_officer_id
      );
    }

    // Apply group filter
    if (filters.group_id !== 'all') {
      filtered = filtered.filter(tx => 
        tx.group_id === filters.group_id
      );
    }

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(tx => 
        tx.member_name?.toLowerCase().includes(searchTerm) ||
        tx.loan_account_number?.toLowerCase().includes(searchTerm) ||
        tx.reference_number?.toLowerCase().includes(searchTerm) ||
        tx.description?.toLowerCase().includes(searchTerm) ||
        tx.group_name?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply pagination
    const totalFiltered = filtered.length;
    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage;
    const paginated = filtered.slice(from, to);

    setTransactions(paginated);
    setTotalTransactions(totalFiltered);
    setTotalPages(Math.ceil(totalFiltered / itemsPerPage));
  }, [allTransactions, filters, dateRange, currentPage, itemsPerPage, user, userRole, profile]);

  // Fetch branches and loan officers for filters
  const fetchFilterData = async () => {
    try {
      // Fetch branches
      const { data: branchesData } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');

      if (branchesData) {
        setBranches(branchesData);
      }

      // Fetch groups
      const { data: groupsData } = await supabase
        .from('groups')
        .select('id, name')
        .order('name');

      if (groupsData) {
        setGroups(groupsData);
      }

      // Fetch loan officers (including super admins and admins who also create loans)
      const { data: officersData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['loan_officer', 'super_admin', 'admin'])
        .order('full_name');

      if (officersData) {
        setLoanOfficers(officersData);
      }

    } catch (error) {
      console.error('Error fetching filter data:', error);
    }
  };

  // Handle filter changes - triggers immediate fetch via useEffect
  const handleFilterChange = (key: keyof TransactionFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Apply filters - reset to page 1 and re-apply filters
  const applyFilters = () => {
    setCurrentPage(1);
    applyFiltersToTransactions();
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      search: '',
      transaction_type: 'all',
      status: 'all',
      payment_method: 'all',
      branch_id: 'all',
      loan_officer_id: 'all',
      group_id: 'all'
    });
    setDateRange({ from: undefined, to: undefined });
    setCurrentPage(1);
  };

  // Refresh data
  const refreshData = async () => {
    setRefreshing(true);
    await fetchTransactions(false); // Full reload with loading
    setRefreshing(false);
  };

  // Navigate to transaction details
  const viewTransaction = (transactionId: string) => {
    navigate(`/transactions/${transactionId}`);
  };

  // Handle delete transaction
  const handleDeleteClick = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return;

    try {
      setIsDeleting(true);
      
      // Delete the payment - the trigger will automatically revert loan balances
      const { error } = await supabase
        .from('loan_payments')
        .delete()
        .eq('id', transactionToDelete.id);

      if (error) {
        throw error;
      }

      toast.success('Transaction deleted successfully. Loan balances have been reverted.');
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
      
      // Refresh transactions
      await fetchTransactions(true); // Skip loading state
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      toast.error(error.message || 'Failed to delete transaction');
    } finally {
      setIsDeleting(false);
    }
  };

  // Get transaction type icon and color
  const getTransactionTypeInfo = (type: string) => {
    switch (type) {
      case 'payment':
        return { icon: TrendingDown, color: 'bg-green-100 text-green-800', label: 'Payment' };
      case 'disbursement':
        return { icon: TrendingUp, color: 'bg-blue-100 text-blue-800', label: 'Disbursement' };
      case 'refund':
        return { icon: TrendingUp, color: 'bg-purple-100 text-purple-800', label: 'Refund' };
      case 'fee':
        return { icon: CreditCard, color: 'bg-orange-100 text-orange-800', label: 'Fee' };
      case 'penalty':
        return { icon: Banknote, color: 'bg-red-100 text-red-800', label: 'Penalty' };
      case 'adjustment':
        return { icon: Wallet, color: 'bg-gray-100 text-gray-800', label: 'Adjustment' };
      default:
        return { icon: CreditCard, color: 'bg-gray-100 text-gray-800', label: type };
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <Badge className={statusConfig[status as keyof typeof statusConfig] || 'bg-gray-100 text-gray-800'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Calculate summary statistics
  const calculateSummary = () => {
    const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const completed = transactions.filter(tx => tx.status === 'completed').reduce((sum, tx) => sum + tx.amount, 0);
    const failed = transactions.filter(tx => tx.status === 'failed').reduce((sum, tx) => sum + tx.amount, 0);

    return { total, completed, failed };
  };

  useEffect(() => {
    fetchFilterData();
  }, []);

  // Initial load
  useEffect(() => {
    fetchTransactions();
  }, []); // Only on mount

  // Apply filters in real-time when filters or pagination change
  useEffect(() => {
    if (allTransactions.length > 0) {
      applyFiltersToTransactions();
    }
  }, [applyFiltersToTransactions]);

  if (loading) {
    return <PageLoader text="Loading transactions..." />;
  }

  const summary = calculateSummary();

  return (
    <div className="space-y-4 md:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-heading-1 text-foreground">Transactions</h1>
          <p className="text-body text-muted-foreground mt-1">
            View and manage all financial transactions and payments.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshData} disabled={refreshing} className="w-full sm:w-auto">
            {refreshing ? (
              <QuickLoader />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <ExportDropdown 
            data={transactions}
            filename="transactions"
            columns={[
              { header: 'Reference', accessorKey: 'reference_number' },
              { header: 'Type', accessorKey: 'transaction_type' },
              { header: 'Amount', accessorKey: 'amount' },
              { header: 'Status', accessorKey: 'status' },
              { header: 'Date', accessorKey: 'transaction_date' },
              { header: 'Member', accessorKey: 'member_name' },
              { header: 'Loan Account', accessorKey: 'loan_account_number' },
              { header: 'Branch', accessorKey: 'branch_name' }
            ]}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 md:gap-4">
        <Card className="p-3 sm:p-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
            <CardTitle className="text-xs md:text-sm font-medium">Total Transactions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="text-xl md:text-2xl font-bold">{totalTransactions}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Across all branches
            </p>
          </CardContent>
        </Card>


        <Card className="p-3 sm:p-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
            <CardTitle className="text-xs md:text-sm font-medium">Completed</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="text-xl md:text-2xl font-bold text-green-600">
              KES {summary.completed.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Successful transactions
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search" className="text-body font-medium">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Reference, member, loan..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10 w-full text-body"
                />
              </div>
            </div>

            {/* Transaction Type */}
            <div className="space-y-2">
              <Label htmlFor="type" className="text-body font-medium">Transaction Type</Label>
              <Select value={filters.transaction_type} onValueChange={(value) => handleFilterChange('transaction_type', value)}>
                <SelectTrigger className="w-full text-body">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="disbursement">Disbursement</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="fee">Fee</SelectItem>
                  <SelectItem value="penalty">Penalty</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status" className="text-body font-medium">Status</Label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger className="w-full text-body">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="method" className="text-body font-medium">Payment Method</Label>
              <Select value={filters.payment_method} onValueChange={(value) => handleFilterChange('payment_method', value)}>
                <SelectTrigger className="w-full text-body">
                  <SelectValue placeholder="All methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-body font-medium">Date Range</Label>
              <DateRangeFilter
                onDateRangeChange={setDateRange}
                placeholder="Filter by date range"
                showPresets={true}
              />
            </div>

            {/* Group */}
            <div className="space-y-2">
              <Label className="text-body font-medium">Group</Label>
              <Select value={filters.group_id} onValueChange={(value) => handleFilterChange('group_id', value)}>
                <SelectTrigger className="w-full text-body">
                  <SelectValue placeholder="All groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Loan Officer */}
            <div className="space-y-2">
              <Label className="text-body font-medium">Loan Officer</Label>
              <Select value={filters.loan_officer_id} onValueChange={(value) => handleFilterChange('loan_officer_id', value)}>
                <SelectTrigger className="w-full text-body">
                  <SelectValue placeholder="All officers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All officers</SelectItem>
                  {loanOfficers.map(officer => (
                    <SelectItem key={officer.id} value={officer.id}>
                      {officer.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
            <Button onClick={applyFilters} className="w-full sm:w-auto text-body">
              Apply Filters
            </Button>
            <Button variant="outline" onClick={clearFilters} className="w-full sm:w-auto text-body">
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-2">Transactions ({transactions.length})</CardTitle>
          <CardDescription className="text-body text-muted-foreground">
            Showing {transactions.length} of {totalTransactions} transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No transactions found matching your criteria
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  header: 'Transaction',
                  cell: (row) => (
                    <div>
                      <Link to={`/transactions/${row.id}`} className="text-body font-medium text-primary hover:underline">
                        {row.reference_number}
                      </Link>
                      <div className="text-caption text-muted-foreground">{row.description}</div>
                    </div>
                  )
                },
                {
                  header: 'Member',
                  cell: (row) => (
                    <div>
                      <div className="text-body">{row.member_name || 'N/A'}</div>
                      <div className="text-caption text-muted-foreground">{row.group_name || 'No Group'}</div>
                    </div>
                  )
                },
                {
                  header: 'Amount',
                  cell: (row) => (
                    <div>
                      <div className="text-body font-medium">KES {row.amount.toLocaleString()}</div>
                      <div className="text-caption text-muted-foreground">{row.currency}</div>
                    </div>
                  )
                },
                {
                  header: 'Type & Status',
                  cell: (row) => (
                    <div>
                      <Badge variant={getTransactionTypeVariant(row.transaction_type)} className="text-caption mb-1">
                        {row.transaction_type}
                      </Badge>
                      <div>
                        <Badge variant={getStatusVariant(row.status)} className="text-caption">
                          {row.status}
                        </Badge>
                      </div>
                    </div>
                  )
                },
                {
                  header: 'Date',
                  cell: (row) => {
                    try {
                      const date = row.transaction_date ? new Date(row.transaction_date) : new Date();
                      if (isNaN(date.getTime())) return <div className="text-body">Invalid Date</div>;
                      return <div className="text-body">{format(date, 'MMM dd, yyyy')}</div>;
                    } catch {
                      return <div className="text-body">N/A</div>;
                    }
                  }
                },
                {
                  header: 'Loan Officer',
                  cell: (row) => (
                    <div className="text-body">
                      {row.loan_officer_name || 'Not assigned'}
                    </div>
                  )
                },
                {
                  header: 'Actions',
                  cell: (row) => (
                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/transactions/${row.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {(userRole === 'super_admin' || userRole === 'admin') && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteClick(row)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )
                }
              ]}
              data={transactions}
              searchTerm={filters.search}
              emptyStateMessage="No transactions found matching your criteria."
            />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
              <div className="text-sm text-gray-700 text-center sm:text-left">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalTransactions)} of {totalTransactions} results
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  size="sm"
                >
                  Previous
                </Button>
                
                <span className="flex items-center px-3 py-2 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Transaction Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Transaction
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete this transaction? This action will revert the loan balance to its state before this payment was made.
              </p>
              {transactionToDelete && (
                <div className="bg-destructive/10 p-3 rounded-md mt-2">
                  <p className="text-sm font-medium">Transaction Details:</p>
                  <p className="text-sm">Reference: {transactionToDelete.reference_number}</p>
                  <p className="text-sm">Amount: KES {transactionToDelete.amount.toLocaleString()}</p>
                  <p className="text-sm">Member: {transactionToDelete.member_name}</p>
                  <p className="text-sm">Date: {format(new Date(transactionToDelete.transaction_date), 'MMM dd, yyyy')}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTransaction}
              disabled={isDeleting}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? 'Deleting...' : 'Delete Transaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Transactions;