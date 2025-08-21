import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Search, Plus, Eye, CreditCard, Landmark, Banknote, Loader2, DollarSign, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table'; // Reusable component

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

  // --- THE CRITICAL FIX: Simplified and Corrected Data Fetching ---
  const fetchLoans = async () => {
    try {
      // We no longer call the RPC function. We query the view directly.
      // The new, simple RLS policies on the `loans` table handle all the security automatically.
      const { data, error } = await supabase
        .from('loans_with_details') // Query the view
        .select('*');             // Select all columns from the view

      if (error) throw error;
      setLoans(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch loans', { description: error.message });
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
        toast.info("Loan data has been updated in real-time.", { description: "Refreshing list..." });
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

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
  const getStatusVariant = (status: LoanStatus) => {
    switch (status) { case 'active': return 'default'; case 'repaid': return 'success'; case 'defaulted': return 'destructive'; case 'pending': return 'warning'; default: return 'secondary'; }
  };

  const columns = [
    { header: 'Member', cell: (row: LoanSummary) => <div><div className="font-medium">{row.member_name}</div><div className="text-sm text-muted-foreground">{row.branch_name}</div></div> },
    { header: 'Principal', cell: (row: LoanSummary) => <div className="font-mono">{formatCurrency(row.principal_amount)}</div> },
    { header: 'Outstanding', cell: (row: LoanSummary) => <div className="font-mono">{formatCurrency(row.current_balance)}</div> },
    { header: 'Progress', cell: (row: LoanSummary) => {
        const totalDue = row.principal_amount + (row.current_balance - row.principal_amount + row.total_paid);
        const progress = totalDue > 0 ? (row.total_paid / totalDue) * 100 : (row.status === 'repaid' ? 100 : 0);
        return <div className="flex items-center gap-2"><Progress value={progress} className="w-24 h-2" /><span className="text-sm font-medium">{progress.toFixed(0)}%</span></div>
    }},
    { header: 'Due Date', cell: (row: LoanSummary) => new Date(row.due_date).toLocaleDateString() },
    { header: 'Status', cell: (row: LoanSummary) => <Badge variant={getStatusVariant(row.status)} className="capitalize">{row.status}</Badge> },
    { header: 'Actions', cell: (row: LoanSummary) => <div className="text-right"><Button asChild variant="outline" size="icon"><Link to={`/loans/${row.id}`}><Eye className="h-4 w-4" /></Link></Button></div> },
  ];

  const totalOutstanding = loans.reduce((sum, loan) => sum + (loan.current_balance > 0 ? loan.current_balance : 0), 0);
  
  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Loan Accounts</h1>
          <p className="text-muted-foreground">Manage and monitor all loan accounts in your scope.</p>
        </div>
        <Button asChild><Link to="/loans/new"><Plus className="h-4 w-4 mr-2" />New Loan</Link></Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loans.length}</div>
            <p className="text-xs text-muted-foreground">Active accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">Total due</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loans.filter(l => l.status === 'active').length}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Defaulted</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loans.filter(l => l.status === 'defaulted').length}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Loan Accounts</CardTitle>
              <CardDescription>Showing {filteredLoans.length} of {loans.length} loans.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by member name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
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
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={filteredLoans} emptyStateMessage="No loans found matching your criteria." />
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard: React.FC<{title: string, value: string | number, icon: React.ElementType}> = ({ title, value, icon: Icon }) => (
    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>
);

export default LoansPage;