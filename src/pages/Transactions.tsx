import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Wallet
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [loanOfficers, setLoanOfficers] = useState<any[]>([]);
  
  // Filters
  const [filters, setFilters] = useState<TransactionFilters>({
    search: '',
    transaction_type: 'all',
    status: 'all',
    payment_method: 'all',
    branch_id: 'all',
    loan_officer_id: 'all'
  });
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const itemsPerPage = 20;

  // Fetch transactions based on user role and filters
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // NOTE: The transactions table doesn't exist yet in the schema
      // This is a placeholder implementation
      let query = supabase
        .from('loan_payments')  // Use loan_payments instead of transactions
        .select('*')
        .order('payment_date', { ascending: false });

      // Apply only basic filters (no relationship filters)
      if (userRole === 'branch_admin' && profile?.branch_id) {
        query = query.eq('branch_id', profile.branch_id);
      }
      // Note: loan_officer filtering will be done after getting the data

      // Apply basic filters
      if (filters.transaction_type !== 'all') {
        query = query.eq('transaction_type', filters.transaction_type);
      }
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.payment_method !== 'all') {
        query = query.eq('payment_method', filters.payment_method);
      }
      if (filters.branch_id !== 'all') {
        query = query.eq('branch_id', filters.branch_id);
      }
      if (dateRange.from) {
        query = query.gte('payment_date', dateRange.from.toISOString().split('T')[0]);
      }
      if (dateRange.to) {
        query = query.lte('payment_date', dateRange.to.toISOString().split('T')[0]);
      }
      if (filters.search) {
        query = query.or(`
          reference_number.ilike.%${filters.search}%,
          description.ilike.%${filters.search}%
        `);
      }

      // Create a separate query for counting (without pagination)
      let countQuery = supabase
        .from('loan_payments')  // Use loan_payments instead of transactions
        .select('*', { count: 'exact', head: true });

      // Apply the same basic filters to count query
      if (userRole === 'branch_admin' && profile?.branch_id) {
        countQuery = countQuery.eq('branch_id', profile.branch_id);
      }

      if (filters.transaction_type !== 'all') {
        countQuery = countQuery.eq('transaction_type', filters.transaction_type);
      }
      if (filters.status !== 'all') {
        countQuery = countQuery.eq('status', filters.status);
      }
      if (filters.payment_method !== 'all') {
        countQuery = countQuery.eq('payment_method', filters.payment_method);
      }
      if (filters.branch_id !== 'all') {
        countQuery = countQuery.eq('branch_id', filters.branch_id);
      }
      if (dateRange.from) {
        countQuery = countQuery.gte('payment_date', dateRange.from.toISOString().split('T')[0]);
      }
      if (dateRange.to) {
        countQuery = countQuery.lte('payment_date', dateRange.to.toISOString().split('T')[0]);
      }
      if (filters.search) {
        countQuery = countQuery.or(`
          reference_number.ilike.%${filters.search}%,
          description.ilike.%${filters.search}%
        `);
      }

      // Get count
      const { count } = await countQuery;
      
      // Apply pagination to main query
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching transactions:', error);
        toast.error('Failed to fetch transactions');
        return;
      }

      if (!data || data.length === 0) {
        setTransactions([]);
        setTotalTransactions(0);
        setTotalPages(1);
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
        memberIds.length > 0 ? supabase.from('members').select('id, first_name, last_name, phone_number, id_number, assigned_officer_id').in('id', memberIds) : { data: [], error: null },
        branchIds.length > 0 ? supabase.from('branches').select('id, name').in('id', branchIds) : { data: [], error: null }
      ]);

      // Create lookup maps
      const loansMap = new Map((loansRes.data || []).map(loan => [loan.id, loan]));
      const membersMap = new Map((membersRes.data || []).map((member: any) => {
        const fullName = member?.first_name && member?.last_name 
          ? `${member.first_name} ${member.last_name}`.trim()
          : member?.first_name || member?.last_name || 'Unknown Member';
        return [member.id, { ...member, full_name: fullName }];
      }));
      const branchesMap = new Map((branchesRes.data || []).map(branch => [branch.id, branch]));

      // Transform data to match our interface
      let transformedTransactions: Transaction[] = data.map(tx => {
        const loan = loansMap.get(tx.loan_id);
        // Get member_id from loan, not from the payment record
        const member = loan?.member_id ? membersMap.get(loan.member_id) : null;
        const branch = loan?.branch_id ? branchesMap.get(loan.branch_id) : null;

        // Map loan_payments fields to transaction interface
        // loan_payments uses 'payment_date' instead of 'transaction_date'
        const paymentDate = tx.payment_date || tx.created_at || new Date().toISOString();
        
        return {
          id: tx.id,
          transaction_type: tx.payment_type || 'payment', // Map payment_type to transaction_type
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
          loan_officer_id: loan?.loan_officer_id || (member as any)?.assigned_officer_id || null,
          loan_officer_name: '', // Will be fetched separately if needed
          
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

      // Apply client-side filtering after data transformation
      if (userRole === 'loan_officer') {
        transformedTransactions = transformedTransactions.filter(tx => 
          tx.loan_officer_id === user?.id
        );
      }

      // Apply loan officer filter if selected
      if (filters.loan_officer_id !== 'all') {
        transformedTransactions = transformedTransactions.filter(tx => 
          tx.loan_officer_id === filters.loan_officer_id
        );
      }

      // Apply advanced search filtering (member name, loan account number)
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        transformedTransactions = transformedTransactions.filter(tx => 
          tx.member_name?.toLowerCase().includes(searchTerm) ||
          tx.loan_account_number?.toLowerCase().includes(searchTerm) ||
          tx.reference_number?.toLowerCase().includes(searchTerm) ||
          tx.description?.toLowerCase().includes(searchTerm)
        );
      }

      setTransactions(transformedTransactions);
      setTotalTransactions(count || 0);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));

    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

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

      // Fetch loan officers
      const { data: officersData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'loan_officer')
        .order('full_name');

      if (officersData) {
        setLoanOfficers(officersData);
      }

    } catch (error) {
      console.error('Error fetching filter data:', error);
    }
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof TransactionFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Apply filters
  const applyFilters = () => {
    fetchTransactions();
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      search: '',
      transaction_type: 'all',
      status: 'all',
      payment_method: 'all',
      branch_id: 'all',
      loan_officer_id: 'all'
    });
    setDateRange({ from: undefined, to: undefined });
    setCurrentPage(1);
  };

  // Refresh data
  const refreshData = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  // Navigate to transaction details
  const viewTransaction = (transactionId: string) => {
    navigate(`/transactions/${transactionId}`);
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

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, filters]);

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

            {/* Branch */}
            <div className="space-y-2">
              <Label className="text-body font-medium">Branch</Label>
              <Select value={filters.branch_id} onValueChange={(value) => handleFilterChange('branch_id', value)}>
                <SelectTrigger className="w-full text-body">
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
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
                      <div className="text-caption text-muted-foreground">{row.loan_account_number || 'N/A'}</div>
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
                  header: 'Actions',
                  cell: (row) => (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/transactions/${row.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
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
    </div>
  );
};

export default Transactions;