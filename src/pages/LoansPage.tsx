import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, Plus, Eye, Edit, CreditCard, Landmark, Banknote, Loader2, DollarSign, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table'; // Reusable component
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { DateRangeFilter, DateRange, filterDataByDateRange } from '@/components/ui/DateRangeFilter';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DeleteLoanDialog } from '@/components/loans/DeleteLoanDialog';

// --- Type Definitions ---
type LoanStatus = 'active' | 'repaid' | 'defaulted' | 'pending';
interface LoanSummary {
  id: string;
  member_name?: string;
  branch_name?: string;
  loan_officer_name?: string;
  principal_amount: number;
  current_balance: number;
  total_paid: number;
  due_date: string;
  status: LoanStatus;
  interest_disbursed?: number;
  processing_fee?: number;
  approval_status?: 'pending' | 'approved' | 'rejected';
}

const LoansPage: React.FC = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [loans, setLoans] = useState<LoanSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [officerFilter, setOfficerFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<LoanSummary | null>(null);

  // --- THE PROPER FIX: Fetch Names Without Relationship Conflicts ---
  const fetchLoans = async () => {
    try {
      setLoading(true);
      
      // Step 1: Fetch all loans
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('*');

      if (loansError) {
        throw loansError;
      }
      
      if (!loansData || loansData.length === 0) {
        setLoans([]);
        setLoading(false);
        return;
      }
      
      // Step 2: Collect all unique IDs for batch fetching
      const memberIds = [...new Set(loansData.map(loan => loan.member_id || loan.customer_id).filter(Boolean))];
      const branchIds = [...new Set(loansData.map(loan => loan.branch_id).filter(Boolean))];
      const officerIds = [...new Set(loansData.map(loan => loan.loan_officer_id).filter(Boolean))];
      
      // Step 3: Batch fetch related data
      const [membersRes, branchesRes, officersRes] = await Promise.all([
        memberIds.length > 0 ? supabase.from('members').select('id, full_name').in('id', memberIds) : { data: [], error: null },
        branchIds.length > 0 ? supabase.from('branches').select('id, name').in('id', branchIds) : { data: [], error: null },
        officerIds.length > 0 ? supabase.from('profiles').select('id, full_name').in('id', officerIds) : { data: [], error: null }
      ]);
      
      // Step 4: Create lookup maps
      const membersMap = new Map((membersRes.data || []).map(m => [m.id, m.full_name]));
      const branchesMap = new Map((branchesRes.data || []).map(b => [b.id, b.name]));
      const officersMap = new Map((officersRes.data || []).map(o => [o.id, o.full_name]));
      
      // Step 5: Transform loans with real names
      const transformedLoansAll = loansData.map(loan => {
        const memberId = loan.member_id || loan.customer_id;
        const memberName = memberId ? (membersMap.get(memberId) || `Unknown Member (${memberId.slice(0, 8)})`) : 'Unassigned Member';
        const branchName = loan.branch_id ? (branchesMap.get(loan.branch_id) || `Unknown Branch (${loan.branch_id})`) : 'Unknown Branch';
        const officerName = loan.loan_officer_id ? (officersMap.get(loan.loan_officer_id) || `Unknown Officer (${loan.loan_officer_id.slice(0, 8)})`) : 'Unassigned Officer';
        
        return {
          id: loan.id,
          member_name: memberName,
          branch_name: branchName,
          loan_officer_name: officerName,
          principal_amount: loan.principal_amount || 0,
          current_balance: loan.current_balance || 0,
          total_paid: loan.total_paid || 0,
          due_date: loan.due_date || new Date().toISOString().split('T')[0],
          status: loan.status || 'pending',
          member_id: memberId,
          branch_id: loan.branch_id,
          loan_officer_id: loan.loan_officer_id,
          interest_disbursed: loan.interest_disbursed || 0,
          processing_fee: loan.processing_fee || 0,
          approval_status: loan.approval_status || 'pending'
        };
      });

      // Step 6: Hide pending (unapproved) loans for non-admin users
      // Show all repayment statuses (including 'pending' = not fully repaid)
      // Approval state is shown separately via approval_status badge
      setLoans(transformedLoansAll);
    } catch (error: any) {
      toast.error('Failed to fetch loans', { description: error.message });
      setLoans([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();

    // --- REAL-TIME DATA SYNC ---
    const channel = supabase
      .channel('public:loans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, (payload) => {
        fetchLoans(); // Refetch data when any change occurs
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'loans' }, (payload) => {
        // Remove deleted loan from state immediately
        setLoans(prev => prev.filter(loan => loan.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // The dependency on `user` is no longer needed here as RLS is session-based

  const filteredLoans = loans.filter(loan => {
    const searchMatch = (loan.member_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = statusFilter === 'all' || loan.status === statusFilter;
    const branchMatch = branchFilter === 'all' || (loan.branch_name || '').toLowerCase().includes(branchFilter.toLowerCase());
    const officerMatch = officerFilter === 'all' || (loan.loan_officer_name || '').toLowerCase().includes(officerFilter.toLowerCase());
    return searchMatch && statusMatch && branchMatch && officerMatch;
  });

  // Apply date filtering to the already filtered loans
  const dateFilteredLoans = filterDataByDateRange(filteredLoans, dateRange, 'due_date');

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
  const getStatusVariant = (status: LoanStatus) => {
    switch (status) { 
      case 'active': return 'default'; 
      case 'repaid': return 'success'; 
      case 'defaulted': return 'destructive'; 
      case 'pending': return 'warning'; 
      default: return 'secondary'; 
    }
  };

  // Helper function to check if a loan can be edited
  const isLoanEditable = (status: LoanStatus): boolean => {
    return status === 'active' || status === 'pending';
  };

  // Helper function to check if user has edit permissions
  const hasEditPermissions = (): boolean => {
    return userRole === 'super_admin';
  };

  const columns = [
    { header: 'Member', cell: (row: LoanSummary) => <div><div className="font-medium">{row.member_name}</div><div className="text-sm text-muted-foreground">{row.branch_name}</div></div> },
    { header: 'Principal', cell: (row: LoanSummary) => <div className="font-mono">{formatCurrency(row.principal_amount)}</div> },
    { header: 'Outstanding', cell: (row: LoanSummary) => <div className="font-mono">{formatCurrency(row.current_balance)}</div> },
    { header: 'Progress', cell: (row: LoanSummary) => {
        // Calculate total amount due (principal + interest + processing fee)
        // For now, we'll use a simplified calculation, but ideally this should include processing_fee
        const totalAmountDue = row.principal_amount + (row.interest_disbursed || 0) + (row.processing_fee || 0);
        
        // Calculate progress based on total paid vs total amount due
        let progress = 0;
        if (totalAmountDue > 0) {
            progress = Math.min(100, (row.total_paid / totalAmountDue) * 100);
        } else if (row.status === 'repaid') {
            progress = 100;
        }
        
        // Ensure progress is 100% for fully repaid loans
        if (row.status === 'repaid' && row.total_paid > 0) {
            progress = 100;
        }
        
        return (
            <div className="flex items-center gap-2">
                <Progress 
                    value={progress} 
                    className="w-24 h-2" 
                    style={{
                        '--progress-background': row.status === 'repaid' ? 'hsl(142.1 76.2% 36.3%)' : undefined
                    } as React.CSSProperties}
                />
                <span className="text-sm font-medium">{progress.toFixed(0)}%</span>
            </div>
        );
    }},
    { header: 'Due Date', cell: (row: LoanSummary) => new Date(row.due_date).toLocaleDateString() },
    { header: 'Status', cell: (row: LoanSummary) => (
      <div className="flex items-center gap-2">
        <Badge variant={getStatusVariant(row.status)} className="capitalize">{row.status}</Badge>
        <Badge variant={row.approval_status === 'approved' ? 'success' as any : row.approval_status === 'rejected' ? 'destructive' : 'secondary'} className="capitalize">
          {row.approval_status}
        </Badge>
      </div>
    ) },
    { 
      header: (
        <div className="flex items-center gap-2">
          <span>Actions</span>
          {hasEditPermissions() && (
            <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50">
              Super Admin
            </Badge>
          )}
        </div>
      ), 
      cell: (row: LoanSummary) => (
        <div className="flex items-center justify-end gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="outline" size="icon">
                  <Link to={`/loans/${row.id}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View Loan Details</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {hasEditPermissions() && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {!isLoanEditable(row.status) ? (
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="text-gray-400 cursor-not-allowed opacity-50"
                      disabled
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Edit Loan</AlertDialogTitle>
                          <AlertDialogDescription>
                            You are about to edit loan for <strong>{row.member_name}</strong> (KES {row.principal_amount.toLocaleString()}). 
                            This action is restricted to Super Admins only.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => navigate(`/loans/${row.id}/edit`)}>
                            Continue to Edit
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {!isLoanEditable(row.status) 
                      ? 'Cannot edit completed/defaulted loans' 
                      : 'Edit Loan (Super Admin Only)'
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {hasEditPermissions() && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setLoanToDelete(row);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete Loan (Super Admin Only)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    },
  ];

  // Export columns configuration
  const exportColumns = [
    { header: 'Member Name', accessorKey: 'member_name' },
    { header: 'Branch', accessorKey: 'branch_name' },
    { header: 'Principal Amount', accessorKey: (row: LoanSummary) => formatCurrency(row.principal_amount) },
    { header: 'Current Balance', accessorKey: (row: LoanSummary) => formatCurrency(row.current_balance) },
    { header: 'Total Paid', accessorKey: (row: LoanSummary) => formatCurrency(row.total_paid) },
    { header: 'Due Date', accessorKey: (row: LoanSummary) => new Date(row.due_date).toLocaleDateString() },
    { header: 'Status', accessorKey: 'status' },
    { header: 'Progress %', accessorKey: (row: LoanSummary) => {
      const totalDue = row.principal_amount + (row.current_balance - row.principal_amount + row.total_paid);
      const progress = totalDue > 0 ? (row.total_paid / totalDue) * 100 : (row.status === 'repaid' ? 100 : 0);
      return `${progress.toFixed(0)}%`;
    }},
  ];

  const totalOutstanding = loans
    .filter(loan => loan.status !== 'repaid')
    .reduce((sum, loan) => sum + (loan.current_balance > 0 ? loan.current_balance : 0), 0);
  
  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

  return (
    <div className="space-y-4 md:space-y-6 p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Loan Accounts</h1>
          <p className="text-muted-foreground text-sm md:text-base">Manage and monitor all loan accounts in your scope.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <ExportDropdown 
            data={dateFilteredLoans} 
            columns={exportColumns} 
            fileName="loans-report" 
            reportTitle="Loans Report"
            dateRange={dateRange}
            className="w-full sm:w-auto"
          />
          <Button asChild className="w-full sm:w-auto">
            <Link to="/loans/new">
              <Plus className="h-4 w-4 mr-2" />
              New Loan
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Loans" value={loans.length} icon={CreditCard} />
        <StatCard title="Outstanding Balance" value={formatCurrency(totalOutstanding)} icon={Landmark} />
        <StatCard title="Active Loans" value={loans.filter(l => l.status === 'active' || l.status === 'pending').length} icon={Banknote} />
        <StatCard title="Repaid Loans" value={loans.filter(l => l.status === 'repaid').length} icon={DollarSign} />
        <StatCard title="Defaulted" value={loans.filter(l => l.status === 'defaulted').length} icon={AlertTriangle} />
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg">Loan Accounts</CardTitle>
                <CardDescription className="text-sm">
                  Showing {dateFilteredLoans.length} of {filteredLoans.length} loans
                  {statusFilter === 'all' && (
                    <span className="text-brand-green-600 font-medium">
                      {' '}• Showing all loan statuses
                    </span>
                  )}
                  {statusFilter !== 'all' && (
                    <span className="text-brand-green-600 font-medium">
                      {' '}• Filtered by status: {statusFilter}
                    </span>
                  )}
                  {branchFilter !== 'all' && (
                    <span className="text-brand-green-600 font-medium">
                      {' '}• Branch: {branchFilter}
                    </span>
                  )}
                  {officerFilter !== 'all' && (
                    <span className="text-brand-green-600 font-medium">
                      {' '}• Officer: {officerFilter}
                    </span>
                  )}
                  {dateRange.from && dateRange.to && (
                    <span className="text-brand-green-600 font-medium">
                      {' '}• Filtered by date range
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            
            {/* Filters Row - Better positioned and spaced */}
            <div className="flex flex-col lg:flex-row gap-3 md:gap-4 w-full">
              {/* Date Filter - Takes priority */}
              <div className="flex-shrink-0">
                <DateRangeFilter
                  onDateRangeChange={setDateRange}
                  placeholder="Filter by date"
                  className="w-full lg:w-auto"
                />
              </div>
              
              {/* Search and Status Filters */}
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by member name..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="pl-9 w-full" 
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="repaid">Repaid</SelectItem>
                    <SelectItem value="defaulted">Defaulted</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Branch and Loan Officer Filters */}
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <div className="relative flex-1 min-w-0">
                  <Input 
                    placeholder="Filter by branch..." 
                    value={branchFilter === 'all' ? '' : branchFilter} 
                    onChange={e => setBranchFilter(e.target.value || 'all')} 
                    className="w-full" 
                  />
                </div>
                <div className="relative flex-1 min-w-0">
                  <Input 
                    placeholder="Filter by loan officer..." 
                    value={officerFilter === 'all' ? '' : officerFilter} 
                    onChange={e => setOfficerFilter(e.target.value || 'all')} 
                    className="w-full" 
                  />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={dateFilteredLoans} emptyStateMessage="No loans found matching your criteria." />
        </CardContent>
      </Card>

      {/* Delete Loan Dialog */}
      {loanToDelete && (
        <DeleteLoanDialog
          isOpen={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setLoanToDelete(null);
          }}
          loan={loanToDelete}
          onDeleted={() => {
            setDeleteDialogOpen(false);
            setLoanToDelete(null);
            fetchLoans(); // Refresh the loans list
          }}
        />
      )}
    </div>
  );
};

const StatCard: React.FC<{title: string, value: string | number, icon: React.ElementType}> = ({ title, value, icon: Icon }) => (
  <Card className="bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md p-3 sm:p-4">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
      <CardTitle className="text-xs md:text-sm font-medium text-brand-green-800">{title}</CardTitle>
      <Icon className="h-4 w-4 text-brand-green-600" />
    </CardHeader>
    <CardContent className="px-0 pb-0">
      <div className="text-xl md:text-2xl font-bold text-brand-green-700">{value}</div>
    </CardContent>
  </Card>
);

export default LoansPage;