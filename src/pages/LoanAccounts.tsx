import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Edit, Eye, CreditCard, Calendar, DollarSign } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LoanAccount {
  id: string;
  principal_amount: number;
  interest_rate: number;
  issue_date: string;
  due_date: string;
  current_balance: number;
  status: string;
  interest_type: string;
  repayment_schedule: string;
  customer_id: string;
  group_id?: number;
  branch_id?: number;
  loan_officer_id?: string;
  created_at: string;
  member_name?: string;
  group_name?: string;
  branch_name?: string;
  loan_officer_name?: string;
  total_paid?: number;
}

const LoanAccounts = () => {
  const { userRole, isSuperAdmin } = useAuth();
  const [loans, setLoans] = useState<LoanAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [branches, setBranches] = useState<any[]>([]);

  const fetchLoans = async () => {
    try {
      const { data: loansData, error } = await supabase
        .from('loans')
        .select(`
          *,
          members:customer_id (full_name),
          groups:group_id (name),
          branches:branch_id (name)
        `);

      if (error) throw error;

      // Get repayment totals for each loan
      const loansWithPayments = await Promise.all(
        (loansData || []).map(async (loan) => {
          const { data: repaymentsData } = await supabase
            .from('repayments')
            .select('amount')
            .eq('loan_id', loan.id);

          const totalPaid = repaymentsData?.reduce(
            (sum, payment) => sum + parseFloat(String(payment.amount || '0')), 0
          ) || 0;

          return {
            ...loan,
            member_name: loan.members?.full_name,
            group_name: loan.groups?.name,
            branch_name: loan.branches?.name,
            loan_officer_name: 'N/A', // Remove loan officer lookup for now
            total_paid: totalPaid
          };
        })
      );

      setLoans(loansWithPayments);
    } catch (error) {
      console.error('Error fetching loans:', error);
      toast.error('Failed to fetch loan accounts');
    }
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*');
      
      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchLoans(), fetchBranches()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const filteredLoans = loans.filter(loan => {
    const matchesSearch = (loan.member_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (loan.group_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         loan.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || loan.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || loan.branch_name === branchFilter;
    return matchesSearch && matchesStatus && matchesBranch;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const calculateProgress = (totalPaid: number, loanAmount: number) => {
    return loanAmount > 0 ? (totalPaid / loanAmount) * 100 : 0;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'repaid': return 'secondary';
      case 'defaulted': return 'destructive';
      default: return 'secondary';
    }
  };

  const calculateMonthlyPayment = (principal: number, rate: number, months: number) => {
    if (rate === 0) return principal / months;
    const monthlyRate = rate / 100 / 12;
    return principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  };

  const getMonthsDifference = (issueDate: string, dueDate: string) => {
    const issue = new Date(issueDate);
    const due = new Date(dueDate);
    return Math.round((due.getTime() - issue.getTime()) / (1000 * 60 * 60 * 24 * 30));
  };

  if (loading) {
    return <Loader size="lg" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Loan Accounts</h1>
          <p className="text-muted-foreground">Manage and monitor all loan accounts</p>
        </div>
        {isSuperAdmin && (
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            New Loan
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{loans.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Active Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{loans.filter(l => l.status === 'active').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Disbursed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(loans.reduce((sum, l) => sum + parseFloat(String(l.principal_amount || '0')), 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">
              {formatCurrency(loans.reduce((sum, l) => sum + parseFloat(String(l.current_balance || '0')), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loan Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Loan Portfolio</CardTitle>
          <CardDescription>Complete overview of all loan accounts and their performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Loans</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by member name, group, or loan ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full lg:w-48">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={(value: string) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="repaid">Repaid</SelectItem>
                  <SelectItem value="defaulted">Defaulted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full lg:w-48">
              <Label htmlFor="branch">Branch</Label>
              <Select value={branchFilter} onValueChange={(value: string) => setBranchFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.name}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Loans Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan Details</TableHead>
                  <TableHead>Member & Group</TableHead>
                  <TableHead>Loan Terms</TableHead>
                  <TableHead>Financial Summary</TableHead>
                  <TableHead>Payment Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoans.map((loan) => {
                  const months = getMonthsDifference(loan.issue_date, loan.due_date);
                  const monthlyPayment = calculateMonthlyPayment(
                    parseFloat(String(loan.principal_amount)), 
                    parseFloat(String(loan.interest_rate)), 
                    months
                  );
                  
                  return (
                    <TableRow key={loan.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">Loan ID: {loan.id.substring(0, 8)}</div>
                            <div className="text-sm text-muted-foreground">
                              {loan.interest_type} Interest • {loan.repayment_schedule}
                            </div>
                            <div className="text-xs text-muted-foreground">Officer: {loan.loan_officer_name || 'N/A'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{loan.member_name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">{loan.group_name || 'No Group'}</div>
                          <Badge variant="outline" className="text-xs">{loan.branch_name || 'No Branch'}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <DollarSign className="h-3 w-3" />
                            <span className="font-medium">{formatCurrency(parseFloat(String(loan.principal_amount)))}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {parseFloat(String(loan.interest_rate))}% • {months} months
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Issued: {new Date(loan.issue_date).toLocaleDateString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="font-medium">Paid:</span> {formatCurrency(loan.total_paid || 0)}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Outstanding:</span> {formatCurrency(parseFloat(String(loan.current_balance)))}
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-300" 
                              style={{ 
                                width: `${calculateProgress(loan.total_paid || 0, parseFloat(String(loan.principal_amount)))}%` 
                              }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {calculateProgress(loan.total_paid || 0, parseFloat(String(loan.principal_amount))).toFixed(1)}% complete
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            <span className="font-medium">{formatCurrency(monthlyPayment)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Due: {new Date(loan.due_date).toLocaleDateString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(loan.status) as any}>
                          {loan.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isSuperAdmin && (
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {filteredLoans.length === 0 && (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No loan accounts found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LoanAccounts;