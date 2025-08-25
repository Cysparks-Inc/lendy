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
import { PageLoader, InlineLoader } from '@/components/ui/loader';
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { format } from 'date-fns';

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
  date_from: string;
  date_to: string;
  branch_id: string;
  loan_officer_id: string;
}

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
    date_from: '',
    date_to: '',
    branch_id: 'all',
    loan_officer_id: 'all'
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const itemsPerPage = 20;

  // Fetch transactions based on user role and filters
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('transactions')
        .select(`
          *,
          loans(
            id,
            account_number,
            member_id,
            loan_officer_id
          ),
          members(
            id,
            full_name
          ),
          branch_id(
            id,
            name
          ),
          profiles(
            id,
            full_name
          )
        `)
        .order('transaction_date', { ascending: false });

      // Apply role-based filtering
      if (userRole === 'branch_admin' && profile?.branch_id) {
        query = query.eq('branch_id', profile.branch_id);
      } else if (userRole === 'loan_officer') {
        query = query.eq('loans.loan_officer_id', user?.id);
      }
      // Super admin can see all transactions

      // Apply filters
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
      if (filters.loan_officer_id !== 'all') {
        query = query.eq('loans.loan_officer_id', filters.loan_officer_id);
      }
      if (filters.date_from) {
        query = query.gte('transaction_date', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('transaction_date', filters.date_to);
      }
      if (filters.search) {
        query = query.or(`
          reference_number.ilike.%${filters.search}%,
          description.ilike.%${filters.search}%,
          members.full_name.ilike.%${filters.search}%,
          loans.account_number.ilike.%${filters.search}%
        `);
      }

      // Apply pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching transactions:', error);
        toast.error('Failed to fetch transactions');
        return;
      }

      // Transform data to match our interface
      const transformedTransactions: Transaction[] = (data || []).map(tx => ({
        id: tx.id,
        transaction_type: tx.transaction_type,
        amount: tx.amount,
        currency: tx.currency || 'KES',
        status: tx.status,
        payment_method: tx.payment_method,
        reference_number: tx.reference_number,
        description: tx.description,
        transaction_date: tx.transaction_date,
        created_at: tx.created_at,
        updated_at: tx.updated_at,
        
        // Related entities
        loan_id: tx.loans?.id,
        member_id: tx.members?.id,
        loan_account_number: tx.loans?.account_number,
        member_name: tx.members?.full_name,
        branch_id: tx.branch_id,
        branch_name: tx.branch_id?.name, // Assuming branch_id is an object with a 'name' property
        loan_officer_id: tx.loans?.loan_officer_id,
        loan_officer_name: tx.profiles?.full_name,
        
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
      }));

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
      date_from: '',
      date_to: '',
      branch_id: 'all',
      loan_officer_id: 'all'
    });
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
    const pending = transactions.filter(tx => tx.status === 'pending').reduce((sum, tx) => sum + tx.amount, 0);
    const failed = transactions.filter(tx => tx.status === 'failed').reduce((sum, tx) => sum + tx.amount, 0);

    return { total, completed, pending, failed };
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600 mt-1">
            View and manage all financial transactions across the system
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshData} disabled={refreshing}>
            {refreshing ? (
              <InlineLoader size="sm" variant="primary" />
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
            <p className="text-xs text-muted-foreground">
              Across all branches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {summary.total.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              All transaction types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              KES {summary.completed.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Successful transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              KES {summary.pending.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Reference, member, loan..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Transaction Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Transaction Type</label>
              <Select value={filters.transaction_type} onValueChange={(value) => handleFilterChange('transaction_type', value)}>
                <SelectTrigger>
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
              <label className="text-sm font-medium">Status</label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
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
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={filters.payment_method} onValueChange={(value) => handleFilterChange('payment_method', value)}>
                <SelectTrigger>
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
              <label className="text-sm font-medium">Date From</label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date To</label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
              />
            </div>

            {/* Branch */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Branch</label>
              <Select value={filters.branch_id} onValueChange={(value) => handleFilterChange('branch_id', value)}>
                <SelectTrigger>
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
              <label className="text-sm font-medium">Loan Officer</label>
              <Select value={filters.loan_officer_id} onValueChange={(value) => handleFilterChange('loan_officer_id', value)}>
                <SelectTrigger>
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

          <div className="flex gap-2 mt-4">
            <Button onClick={applyFilters}>
              Apply Filters
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>
            Showing {transactions.length} of {totalTransactions} transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No transactions found matching your criteria
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => {
                const typeInfo = getTransactionTypeInfo(transaction.transaction_type);
                const TypeIcon = typeInfo.icon;
                
                return (
                  <div
                    key={transaction.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => viewTransaction(transaction.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Transaction Type Icon */}
                        <div className={`p-2 rounded-full ${typeInfo.color}`}>
                          <TypeIcon className="h-5 w-5" />
                        </div>
                        
                        {/* Transaction Details */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {transaction.reference_number}
                            </span>
                            {getStatusBadge(transaction.status)}
                          </div>
                          
                          <p className="text-sm text-gray-600">
                            {transaction.description}
                          </p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {transaction.member_name || 'Unknown Member'}
                            </span>
                            <span className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3" />
                              {transaction.loan_account_number || 'N/A'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {transaction.branch_name || 'Unknown Branch'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Amount and Date */}
                      <div className="text-right space-y-1">
                        <div className="text-lg font-bold text-gray-900">
                          KES {transaction.amount.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {format(new Date(transaction.transaction_date), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-gray-400">
                          {transaction.payment_method.replace('_', ' ').toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalTransactions)} of {totalTransactions} results
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
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
