import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Search, 
  AlertTriangle, 
  ShieldAlert, 
  Loader2, 
  Banknote, 
  Users, 
  Eye, 
  TrendingDown,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  BarChart3,
  PieChart
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { WriteOffLoanDialog } from '@/components/loans/WriteOffLoanDialog';

// --- Type Definitions ---
interface BadDebtRecord {
  id: string;
  account_number: string;
  member_name: string;
  member_id: string;
  principal_amount: number;
  current_balance: number;
  loan_officer_name: string;
  branch_name: string;
  due_date: string;
  days_overdue: number;
  status: string;
  issue_date: string;
  is_problem: boolean;
}

interface BadDebtStats {
  total_records: number;
  total_principal: number;
  total_outstanding: number;
  average_days_overdue: number;
  highest_overdue: number;
  branch_breakdown: { branch: string; count: number; amount: number }[];
}

const BadDebt: React.FC = () => {
  const { user, userRole, profile } = useAuth();
  const [records, setRecords] = useState<BadDebtRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<BadDebtRecord[]>([]);
  const [stats, setStats] = useState<BadDebtStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWriteOffDialogOpen, setIsWriteOffDialogOpen] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [overdueFilter, setOverdueFilter] = useState<string>('all');

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, userRole, profile]);

  // Apply filters whenever records or filter states change
  useEffect(() => {
    applyFilters();
  }, [records, searchTerm, statusFilter, branchFilter, overdueFilter]);

  const fetchData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      let query = supabase
        .from('loans')
        .select(`
          id,
          account_number,
          principal_amount,
          current_balance,
          status,
          due_date,
          issue_date,
          member_id,
          branch_id,
          loan_officer_id,
          created_by
        `)
        .or('status.eq.defaulted')
        .order('due_date', { ascending: false });

      // Apply role-based filtering
      if (userRole === 'branch_manager' && profile?.branch_id) {
        query = query.eq('branch_id', profile.branch_id);
      } else if (userRole === 'loan_officer') {
        query = query.or(`created_by.eq.${user.id},loan_officer_id.eq.${user.id}`);
      }

      const { data: loans, error: loansError } = await query;
      if (loansError) {
        console.error('Error fetching defaulted loans:', loansError);
        throw loansError;
      }
      console.log('Defaulted loans fetched:', loans?.length || 0);

      // Also fetch loans that are overdue (past due date but still active)
      let overdueQuery = supabase
        .from('loans')
        .select(`
          id,
          account_number,
          principal_amount,
          current_balance,
          status,
          due_date,
          issue_date,
          member_id,
          branch_id,
          loan_officer_id,
          created_by
        `)
        .eq('status', 'active')
        .lt('due_date', new Date().toISOString().split('T')[0]) // Due date is in the past
        .order('due_date', { ascending: false });

      // Apply role-based filtering to overdue query
      if (userRole === 'branch_manager' && profile?.branch_id) {
        overdueQuery = overdueQuery.eq('branch_id', profile.branch_id);
      } else if (userRole === 'loan_officer') {
        overdueQuery = overdueQuery.or(`created_by.eq.${user.id},loan_officer_id.eq.${user.id}`);
      }

      const { data: overdueLoans, error: overdueError } = await overdueQuery;
      if (overdueError) {
        console.warn('Could not fetch overdue loans:', overdueError);
        console.warn('This might be due to date format issues or missing data');
      } else {
        console.log('Overdue loans fetched:', overdueLoans?.length || 0);
      }

      // Combine both sets of loans
      const allLoans = [...(loans || []), ...(overdueLoans || [])];
      console.log('Fetched loans:', { defaulted: loans?.length || 0, overdue: overdueLoans?.length || 0, total: allLoans.length });

      // Fetch additional details for each loan
      const enrichedRecords = await Promise.all(
        (allLoans || []).map(async (loan) => {
          // Get member details
          const { data: member } = await supabase
            .from('members')
            .select('full_name')
            .eq('id', loan.member_id)
            .single();

          // Get branch details
          const { data: branch } = await supabase
            .from('branches')
            .select('name')
            .eq('id', loan.branch_id)
            .single();

          // Get loan officer details
          let loanOfficerName = 'Unassigned';
          if (loan.loan_officer_id) {
            const { data: officer } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', loan.loan_officer_id)
              .single();
            if (officer) loanOfficerName = officer.full_name;
          }

                     // Calculate days overdue
           const dueDate = new Date(loan.due_date);
           const today = new Date();
           const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

           // Determine if this is actually a problem account
           const isProblemAccount = loan.status === 'defaulted' || (loan.status === 'active' && daysOverdue > 0);

           return {
             id: loan.id,
             account_number: loan.account_number,
             member_name: member?.full_name || 'Unknown Member',
             member_id: loan.member_id,
             principal_amount: parseFloat(loan.principal_amount || 0),
             current_balance: parseFloat(loan.current_balance || 0),
             loan_officer_name: loanOfficerName,
             branch_name: branch?.name || 'Unknown Branch',
             due_date: loan.due_date,
             days_overdue: daysOverdue,
             status: loan.status,
             issue_date: loan.issue_date,
             is_problem: isProblemAccount
           };
        })
      );

      setRecords(enrichedRecords);
      calculateStats(enrichedRecords);
      
    } catch (error: any) {
      console.error('Error fetching bad debt data:', error);
      toast.error('Failed to fetch bad debt data', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: BadDebtRecord[]) => {
    const totalPrincipal = data.reduce((sum, record) => sum + record.principal_amount, 0);
    const totalOutstanding = data.reduce((sum, record) => sum + record.current_balance, 0);
    const totalDaysOverdue = data.reduce((sum, record) => sum + record.days_overdue, 0);
    const averageDaysOverdue = data.length > 0 ? Math.round(totalDaysOverdue / data.length) : 0;
    const highestOverdue = Math.max(...data.map(record => record.days_overdue), 0);

    // Branch breakdown
    const branchMap = new Map<string, { count: number; amount: number }>();
    data.forEach(record => {
      const existing = branchMap.get(record.branch_name) || { count: 0, amount: 0 };
      branchMap.set(record.branch_name, {
        count: existing.count + 1,
        amount: existing.amount + record.current_balance
      });
    });

    const branchBreakdown = Array.from(branchMap.entries()).map(([branch, data]) => ({
      branch,
      count: data.count,
      amount: data.amount
    }));

         setStats({
       total_records: data.length,
       total_principal: totalPrincipal,
       total_outstanding: totalOutstanding,
       average_days_overdue: averageDaysOverdue,
       highest_overdue: highestOverdue,
       branch_breakdown: branchBreakdown
     });
  };

  const applyFilters = () => {
    let filtered = [...records];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(record =>
        record.member_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.account_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.loan_officer_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

         // Status filter
     if (statusFilter !== 'all') {
       if (statusFilter === 'overdue') {
         // Overdue loans are active loans past due date
         filtered = filtered.filter(record => record.status === 'active' && record.days_overdue > 0);
       } else {
         filtered = filtered.filter(record => record.status === statusFilter);
       }
     }

    // Branch filter
    if (branchFilter !== 'all') {
      filtered = filtered.filter(record => record.branch_name === branchFilter);
    }

    // Overdue filter
    if (overdueFilter !== 'all') {
      switch (overdueFilter) {
        case '30-60':
          filtered = filtered.filter(record => record.days_overdue >= 30 && record.days_overdue < 60);
          break;
        case '60-90':
          filtered = filtered.filter(record => record.days_overdue >= 60 && record.days_overdue < 90);
          break;
        case '90+':
          filtered = filtered.filter(record => record.days_overdue >= 90);
          break;
        case 'critical':
          filtered = filtered.filter(record => record.days_overdue >= 120);
          break;
      }
    }

    setFilteredRecords(filtered);
  };

  const getOverdueSeverity = (days: number) => {
    if (days >= 120) return 'critical';
    if (days >= 90) return 'high';
    if (days >= 60) return 'medium';
    if (days >= 30) return 'low';
    return 'normal';
  };

     const getStatusBadge = (status: string, daysOverdue: number) => {
     if (status === 'active' && daysOverdue > 0) {
       return <Badge variant="secondary">Overdue</Badge>;
     }
     
     switch (status) {
       case 'defaulted':
         return <Badge variant="destructive">Defaulted</Badge>;
       case 'active':
         return <Badge variant="default">Active</Badge>;
       default:
         return <Badge variant="outline">{status}</Badge>;
     }
   };

  const getOverdueBadge = (days: number) => {
    const severity = getOverdueSeverity(days);
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">{days} days</Badge>;
      case 'high':
        return <Badge variant="destructive">{days} days</Badge>;
      case 'medium':
        return <Badge variant="secondary">{days} days</Badge>;
      case 'low':
        return <Badge variant="outline">{days} days</Badge>;
      default:
        return <Badge variant="outline">{days} days</Badge>;
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  const columns = [
    {
      header: 'Member',
      cell: (row: BadDebtRecord) => (
        <div>
          <Link to={`/members/${row.member_id}`} className="font-medium text-primary hover:underline">
            {row.member_name}
          </Link>
          <div className="text-sm text-muted-foreground">{row.account_number}</div>
        </div>
      )
    },
         {
       header: 'Status',
       cell: (row: BadDebtRecord) => (
         <div className="space-y-1">
           {getStatusBadge(row.status, row.days_overdue)}
           {getOverdueBadge(row.days_overdue)}
         </div>
       )
     },
    {
      header: 'Financials',
      cell: (row: BadDebtRecord) => (
        <div className="text-right">
          <div className="font-semibold text-destructive">{formatCurrency(row.current_balance)}</div>
          <div className="text-sm text-muted-foreground">Principal: {formatCurrency(row.principal_amount)}</div>
        </div>
      )
    },
    {
      header: 'Branch & Officer',
      cell: (row: BadDebtRecord) => (
        <div>
          <div className="font-medium">{row.branch_name}</div>
          <div className="text-sm text-muted-foreground">{row.loan_officer_name}</div>
        </div>
      )
    },
    {
      header: 'Timeline',
      cell: (row: BadDebtRecord) => (
        <div className="text-sm">
          <div>Due: {new Date(row.due_date).toLocaleDateString()}</div>
          <div className="text-muted-foreground">Issued: {new Date(row.issue_date).toLocaleDateString()}</div>
        </div>
      )
    },
    {
      header: 'Actions',
      cell: (row: BadDebtRecord) => (
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" size="icon">
            <Link to={`/loans/${row.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon">
            <Link to={`/members/${row.member_id}`}>
              <Users className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )
    }
  ];

  const exportColumns = [
    { header: 'Member Name', accessorKey: 'member_name' },
    { header: 'Account Number', accessorKey: 'account_number' },
    { header: 'Status', accessorKey: 'status' },
    { header: 'Days Overdue', accessorKey: 'days_overdue' },
    { header: 'Current Balance', accessorKey: 'current_balance' },
    { header: 'Principal Amount', accessorKey: 'principal_amount' },
    { header: 'Branch', accessorKey: 'branch_name' },
    { header: 'Loan Officer', accessorKey: 'loan_officer_name' },
    { header: 'Due Date', accessorKey: 'due_date' },
    { header: 'Issue Date', accessorKey: 'issue_date' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (userRole !== 'super_admin' && userRole !== 'branch_manager' && userRole !== 'loan_officer') {
    return (
      <div className="p-2 sm:p-4 md:p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-yellow-500" />
            <CardTitle className="mt-4">Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to view the Bad Debt report.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 p-2 sm:p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Bad Debt & Overdue Accounts</h1>
            <p className="text-muted-foreground mt-1">
              Monitor and manage accounts with payment issues and overdue loans.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <ExportDropdown 
              data={filteredRecords} 
              columns={exportColumns} 
              fileName="bad_debt_report" 
              reportTitle="Bad Debt Report" 
            />
            {userRole === 'super_admin' && (
              <Button onClick={() => setIsWriteOffDialogOpen(true)}>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Write-off Loan
              </Button>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Problem Accounts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_records}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.total_records > 0 ? 'Requires attention' : 'All good'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(stats.total_outstanding)}
                </div>
                <p className="text-xs text-muted-foreground">
                  At risk of loss
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Days Overdue</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.average_days_overdue}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.average_days_overdue > 90 ? 'Critical' : 'Manageable'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Highest Overdue</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{stats.highest_overdue}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.highest_overdue > 120 ? 'Critical' : 'Days overdue'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Branch Breakdown Chart */}
        {stats?.branch_breakdown && stats.branch_breakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Branch Breakdown
              </CardTitle>
              <CardDescription>
                Distribution of problem accounts across branches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.branch_breakdown.map((branch, index) => (
                  <div key={branch.branch} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{branch.branch}</span>
                      <span className="text-muted-foreground">
                        {branch.count} accounts • {formatCurrency(branch.amount)}
                      </span>
                    </div>
                    <Progress 
                      value={(branch.count / stats.total_records) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
            <CardDescription>
              Narrow down the results to find specific accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <Input
                  placeholder="Search members, accounts, officers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

                             <div className="space-y-2">
                 <label className="text-sm font-medium">Status</label>
                 <Select value={statusFilter} onValueChange={setStatusFilter}>
                   <SelectTrigger>
                     <SelectValue placeholder="All Statuses" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Statuses</SelectItem>
                     <SelectItem value="overdue">Overdue (Past Due)</SelectItem>
                     <SelectItem value="defaulted">Defaulted</SelectItem>
                   </SelectContent>
                 </Select>
               </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Branch</label>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {stats?.branch_breakdown.map(branch => (
                      <SelectItem key={branch.branch} value={branch.branch}>
                        {branch.branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Overdue Period</label>
                <Select value={overdueFilter} onValueChange={setOverdueFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Periods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    <SelectItem value="30-60">30-60 days</SelectItem>
                    <SelectItem value="60-90">60-90 days</SelectItem>
                    <SelectItem value="90+">90+ days</SelectItem>
                    <SelectItem value="critical">Critical (120+ days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Problem Accounts</CardTitle>
            <CardDescription>
              Showing {filteredRecords.length} of {records.length} accounts
              {searchTerm || statusFilter !== 'all' || branchFilter !== 'all' || overdueFilter !== 'all' && ' (filtered)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={filteredRecords}
              searchTerm={searchTerm}
              emptyStateMessage="No problem accounts found matching your criteria."
            />
          </CardContent>
        </Card>
      </div>

      {/* Write-off Dialog */}
      <WriteOffLoanDialog
        open={isWriteOffDialogOpen}
        onOpenChange={setIsWriteOffDialogOpen}
        onSuccess={fetchData}
      />
    </>
  );
};

export default BadDebt;