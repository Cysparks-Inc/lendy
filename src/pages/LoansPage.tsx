import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Search, Plus, Eye, CreditCard, Landmark, Banknote, Loader2, DollarSign, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table'; // Reusable component
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { DateRangeFilter, DateRange, filterDataByDateRange } from '@/components/ui/DateRangeFilter';
import { Label } from '@/components/ui/label';

// --- Type Definitions ---
type LoanStatus = 'active' | 'repaid' | 'defaulted' | 'pending';
interface LoanSummary {
  id: string;
  member_name?: string;
  branch_name?: string;
  principal_amount: number;
  current_balance: number;
  total_paid: number;
  due_date: string;
  status: LoanStatus;
}

const LoansPage: React.FC = () => {
  const { user } = useAuth();
  const [loans, setLoans] = useState<LoanSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [isAddLoanDialogOpen, setIsAddLoanDialogOpen] = useState<boolean>(false);

  // --- THE PROPER FIX: Fetch Names Without Relationship Conflicts ---
  const fetchLoans = async () => {
    try {
      setLoading(true);
      console.log('Starting to fetch loans...');
      
      // Step 1: Fetch all loans
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('*');

      if (loansError) {
        console.error('Loans query error:', loansError);
        throw loansError;
      }
      
      console.log('Raw loans data from database:', loansData);
      
      if (!loansData || loansData.length === 0) {
        console.log('No loans found');
        setLoans([]);
        setLoading(false);
        return;
      }
      
      // Step 2: Collect all unique IDs for batch fetching
      const memberIds = [...new Set(loansData.map(loan => loan.member_id || loan.customer_id).filter(Boolean))];
      const branchIds = [...new Set(loansData.map(loan => loan.branch_id).filter(Boolean))];
      const officerIds = [...new Set(loansData.map(loan => loan.loan_officer_id).filter(Boolean))];
      
      console.log('Unique IDs to fetch:', { memberIds, branchIds, officerIds });
      
      // Step 3: Batch fetch related data
      const [membersRes, branchesRes, officersRes] = await Promise.all([
        memberIds.length > 0 ? supabase.from('members').select('id, full_name').in('id', memberIds) : { data: [], error: null },
        branchIds.length > 0 ? supabase.from('branches').select('id, name').in('id', branchIds) : { data: [], error: null },
        officerIds.length > 0 ? supabase.from('profiles').select('id, full_name').in('id', officerIds) : { data: [], error: null }
      ]);
      
      if (membersRes.error) console.error('Members fetch error:', membersRes.error);
      if (branchesRes.error) console.error('Branches fetch error:', branchesRes.error);
      if (officersRes.error) console.error('Officers fetch error:', officersRes.error);
      
      // Step 4: Create lookup maps
      const membersMap = new Map((membersRes.data || []).map(m => [m.id, m.full_name]));
      const branchesMap = new Map((branchesRes.data || []).map(b => [b.id, b.name]));
      const officersMap = new Map((officersRes.data || []).map(o => [o.id, o.full_name]));
      
      console.log('Lookup maps created:', {
        members: Object.fromEntries(membersMap),
        branches: Object.fromEntries(branchesMap),
        officers: Object.fromEntries(officersMap)
      });
      
      // Step 5: Transform loans with real names
      const transformedLoans = loansData.map(loan => {
        const memberId = loan.member_id || loan.customer_id;
        const memberName = memberId ? (membersMap.get(memberId) || `Unknown Member (${memberId.slice(0, 8)})`) : 'Unassigned Member';
        const branchName = loan.branch_id ? (branchesMap.get(loan.branch_id) || `Unknown Branch (${loan.branch_id})`) : 'Unknown Branch';
        const officerName = loan.loan_officer_id ? (officersMap.get(loan.loan_officer_id) || `Unknown Officer (${loan.loan_officer_id.slice(0, 8)})`) : 'Unassigned Officer';
        
        return {
          id: loan.id,
          member_name: memberName,
          branch_name: branchName,
          principal_amount: loan.principal_amount || 0,
          current_balance: loan.current_balance || 0,
          total_paid: loan.total_paid || 0,
          due_date: loan.due_date || new Date().toISOString().split('T')[0],
          status: loan.status || 'pending',
          member_id: memberId,
          branch_id: loan.branch_id,
          loan_officer_id: loan.loan_officer_id
        };
      });
      
      console.log('Transformed loans with real names:', transformedLoans);
      console.log('Setting loans state with', transformedLoans.length, 'loans');
      setLoans(transformedLoans);
    } catch (error: any) {
      console.error('Error fetching loans:', error);
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
        console.log('Loan data changed, refreshing...');
        fetchLoans(); // Refetch data when any change occurs
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // The dependency on `user` is no longer needed here as RLS is session-based

  const filteredLoans = loans.filter(loan => {
    const searchMatch = (loan.member_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = statusFilter === 'all' || loan.status === statusFilter;
    return searchMatch && statusMatch;
  });

  // Apply date filtering to the already filtered loans
  const dateFilteredLoans = filterDataByDateRange(filteredLoans, dateRange, 'due_date');

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
  const getStatusVariant = (status: LoanStatus) => {
    switch (status) { case 'active': return 'default'; case 'repaid': return 'success'; case 'defaulted': return 'destructive'; case 'pending': return 'warning'; default: return 'secondary'; }
  };

  const handleDeleteLoan = async (loanId: string) => {
    if (!window.confirm('Are you sure you want to delete this loan?')) {
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', loanId);

      if (error) {
        throw error;
      }
      toast.success('Loan deleted successfully!');
      fetchLoans(); // Refresh the table
    } catch (error: any) {
      toast.error('Failed to delete loan', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

  return (
<<<<<<< HEAD
    <div className="space-y-4 md:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-heading-1 text-foreground">Loans</h1>
          <p className="text-body text-muted-foreground mt-1">
            Manage and monitor all loan applications and disbursements.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchLoans} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsAddLoanDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Loan
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-3">Search & Filters</CardTitle>
          <CardDescription className="text-body text-muted-foreground">
            Find specific loans using search and filters
          </CardDescription>
=======
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Loan Accounts</h1>
          <p className="text-muted-foreground">Manage and monitor all loan accounts in your scope.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <ExportDropdown 
            data={dateFilteredLoans} 
            columns={exportColumns} 
            fileName="loans-report" 
            reportTitle="Loans Report"
            dateRange={dateRange}
          />
          <Button asChild><Link to="/loans/new"><Plus className="h-4 w-4 mr-2" />New Loan</Link></Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Loans" value={loans.length} icon={CreditCard} />
        <StatCard title="Outstanding Balance" value={formatCurrency(totalOutstanding)} icon={Landmark} />
        <StatCard title="Active Loans" value={loans.filter(l => l.status === 'active').length} icon={Banknote} />
        <StatCard title="Defaulted" value={loans.filter(l => l.status === 'defaulted').length} icon={AlertTriangle} />
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>Loan Accounts</CardTitle>
                <CardDescription>
                  Showing {dateFilteredLoans.length} of {filteredLoans.length} loans
                  {dateRange.from && dateRange.to && (
                    <span className="text-brand-green-600 font-medium">
                      {' '}• Filtered by date range
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            
            {/* Filters Row - Better positioned and spaced */}
            <div className="flex flex-col lg:flex-row gap-4 w-full">
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
            </div>
          </div>
>>>>>>> parent of c5cf51a (design update)
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search" className="text-body font-medium">Search</Label>
              <Input
                id="search"
                placeholder="Search by member, loan number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-body"
              />
            </div>
            <div>
              <Label htmlFor="status" className="text-body font-medium">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="repaid">Repaid</SelectItem>
                  <SelectItem value="defaulted">Defaulted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="branch" className="text-body font-medium">Branch</Label>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  <SelectItem value="nakuru">Nakuru</SelectItem>
                  <SelectItem value="nairobi">Nairobi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sort" className="text-body font-medium">Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="amount">Amount</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loans Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-2">Loans ({filteredLoans.length})</CardTitle>
          <CardDescription className="text-body text-muted-foreground">
            Showing {filteredLoans.length} of {loans.length} loans
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                header: 'Loan',
                cell: (row) => (
                  <div>
                    <Link to={`/loans/${row.id}`} className="text-body font-medium text-primary hover:underline">
                      {row.id}
                    </Link>
                    <div className="text-caption text-muted-foreground">{row.member_name}</div>
                  </div>
                )
              },
              {
                header: 'Amount',
                cell: (row) => (
                  <div>
                    <div className="text-body font-medium">{formatCurrency(row.principal_amount)}</div>
                    <div className="text-caption text-muted-foreground">N/A</div>
                  </div>
                )
              },
              {
                header: 'Status',
                cell: (row) => (
                  <Badge variant={getStatusVariant(row.status)} className="text-caption">
                    {row.status}
                  </Badge>
                )
              },
              {
                header: 'Officer',
                cell: (row) => (
                  <div className="text-body">{row.member_name || 'Unassigned'}</div>
                )
              },
              {
                header: 'Actions',
                cell: (row) => (
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/loans/${row.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteLoan(row.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              }
            ]}
            data={filteredLoans}
            searchTerm={searchTerm}
            emptyStateMessage="No loans found matching your criteria."
          />
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard: React.FC<{title: string, value: string | number, icon: React.ElementType}> = ({ title, value, icon: Icon }) => (
  <Card className="bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-brand-green-800">{title}</CardTitle>
      <Icon className="h-4 w-4 text-brand-green-600" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-brand-green-700">{value}</div>
    </CardContent>
  </Card>
);

export default LoansPage;