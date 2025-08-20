import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Eye, CreditCard, Calendar, DollarSign } from 'lucide-react';
import { Loader } from '@/components/ui/loader';

interface LoanAccount {
  id: string;
  loan_number: string;
  member_name: string;
  member_code: string;
  group_name: string;
  branch: string;
  loan_amount: number;
  interest_rate: number;
  loan_term: number;
  disbursement_date: string;
  maturity_date: string;
  outstanding_balance: number;
  monthly_payment: number;
  total_paid: number;
  last_payment_date?: string;
  next_payment_date: string;
  status: 'active' | 'completed' | 'overdue' | 'defaulted';
  collateral_type?: string;
  loan_officer: string;
  purpose: string;
}

const LoanAccounts = () => {
  const { userRole, isAdmin } = useAuth();
  const [loans, setLoans] = useState<LoanAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'overdue' | 'defaulted'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  useEffect(() => {
    // Simulate data fetch
    setTimeout(() => {
      setLoans([
        {
          id: '1',
          loan_number: 'LN001-2024',
          member_name: 'Alice Wanjiku Kamau',
          member_code: 'MEM001',
          group_name: 'Upendo Self Help Group',
          branch: 'Nairobi Central',
          loan_amount: 150000,
          interest_rate: 12,
          loan_term: 12,
          disbursement_date: '2024-01-15',
          maturity_date: '2025-01-15',
          outstanding_balance: 125000,
          monthly_payment: 13500,
          total_paid: 25000,
          last_payment_date: '2024-01-10',
          next_payment_date: '2024-02-15',
          status: 'active',
          collateral_type: 'Property Title',
          loan_officer: 'John Doe',
          purpose: 'Business Expansion'
        },
        {
          id: '2',
          loan_number: 'LN002-2024',
          member_name: 'Peter Ochieng Otieno',
          member_code: 'MEM002',
          group_name: 'Harambee Business Group',
          branch: 'Kisumu',
          loan_amount: 100000,
          interest_rate: 15,
          loan_term: 6,
          disbursement_date: '2023-12-01',
          maturity_date: '2024-06-01',
          outstanding_balance: 75000,
          monthly_payment: 18500,
          total_paid: 25000,
          last_payment_date: '2024-01-08',
          next_payment_date: '2024-02-01',
          status: 'overdue',
          loan_officer: 'Jane Smith',
          purpose: 'Agricultural Equipment'
        },
        {
          id: '3',
          loan_number: 'LN003-2023',
          member_name: 'Fatuma Hassan Ali',
          member_code: 'MEM003',
          group_name: 'Tumaini Women Group',
          branch: 'Mombasa',
          loan_amount: 200000,
          interest_rate: 10,
          loan_term: 24,
          disbursement_date: '2023-06-01',
          maturity_date: '2025-06-01',
          outstanding_balance: 0,
          monthly_payment: 9500,
          total_paid: 200000,
          last_payment_date: '2024-01-05',
          next_payment_date: '',
          status: 'completed',
          collateral_type: 'Motor Vehicle',
          loan_officer: 'Peter Kariuki',
          purpose: 'Retail Business'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const branches = [...new Set(loans.map(l => l.branch))];

  const filteredLoans = loans.filter(loan => {
    const matchesSearch = loan.loan_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         loan.member_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         loan.member_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         loan.group_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         loan.purpose.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || loan.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || loan.branch === branchFilter;
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
    return (totalPaid / loanAmount) * 100;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'overdue': return 'destructive';
      case 'defaulted': return 'destructive';
      default: return 'secondary';
    }
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
        {isAdmin && (
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
              {formatCurrency(loans.reduce((sum, l) => sum + l.loan_amount, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">
              {formatCurrency(loans.reduce((sum, l) => sum + l.outstanding_balance, 0))}
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
                  placeholder="Search by loan number, member name, code, group, or purpose..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full lg:w-48">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
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
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
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
                {filteredLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{loan.loan_number}</div>
                          <div className="text-sm text-muted-foreground">{loan.purpose}</div>
                          <div className="text-xs text-muted-foreground">Officer: {loan.loan_officer}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{loan.member_name}</div>
                        <div className="text-sm text-muted-foreground">{loan.member_code}</div>
                        <div className="text-xs text-muted-foreground">{loan.group_name}</div>
                        <Badge variant="outline" className="text-xs">{loan.branch}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign className="h-3 w-3" />
                          <span className="font-medium">{formatCurrency(loan.loan_amount)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {loan.interest_rate}% • {loan.loan_term} months
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {loan.collateral_type && `Collateral: ${loan.collateral_type}`}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="font-medium">Paid:</span> {formatCurrency(loan.total_paid)}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Outstanding:</span> {formatCurrency(loan.outstanding_balance)}
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${calculateProgress(loan.total_paid, loan.loan_amount)}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {calculateProgress(loan.total_paid, loan.loan_amount).toFixed(1)}% complete
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          <span className="font-medium">{formatCurrency(loan.monthly_payment)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Due: {new Date(loan.maturity_date).toLocaleDateString()}
                        </div>
                        {loan.last_payment_date && (
                          <div className="text-xs text-muted-foreground">
                            Last: {new Date(loan.last_payment_date).toLocaleDateString()}
                          </div>
                        )}
                        {loan.next_payment_date && (
                          <div className="text-xs text-muted-foreground">
                            Next: {new Date(loan.next_payment_date).toLocaleDateString()}
                          </div>
                        )}
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
                        {isAdmin && (
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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