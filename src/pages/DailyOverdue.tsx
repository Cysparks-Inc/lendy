import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollableContainer } from '@/components/ui/scrollable-container';
import { Search, Download, FileText, Clock, AlertTriangle, Phone } from 'lucide-react';
import { Loader } from '@/components/ui/loader';

interface OverdueItem {
  id: string;
  loan_number: string;
  member_name: string;
  member_code: string;
  phone: string;
  group_name: string;
  branch: string;
  overdue_amount: number;
  days_overdue: number;
  last_payment_date?: string;
  expected_payment_date: string;
  loan_balance: number;
  monthly_payment: number;
  loan_officer: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

const DailyOverdue = () => {
  const [overdueItems, setOverdueItems] = useState<OverdueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchOverdueLoans();
  }, []);

  const fetchOverdueLoans = async () => {
    try {
      const { data: loansData, error } = await supabase
        .from('loans')
        .select('id, principal_amount, current_balance, due_date, issue_date, status, customer_id, group_id, branch_id, loan_officer_id')
        .eq('status', 'active')
        .lt('due_date', new Date().toISOString().split('T')[0]);

      if (error) throw error;

      // Get additional data separately
      const { data: membersData } = await supabase
        .from('members')
        .select('id, full_name, phone_number, id_number');

      const { data: groupsData } = await supabase
        .from('groups')
        .select('id, name');

      const { data: branchesData } = await supabase
        .from('branches')
        .select('id, name');

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name');

      const { data: repaymentsData } = await supabase
        .from('repayments')
        .select('loan_id, payment_date, amount')
        .order('payment_date', { ascending: false });

      const overdueData: OverdueItem[] = (loansData || []).map(loan => {
        const member = membersData?.find(m => m.id === loan.customer_id);
        const group = groupsData?.find(g => g.id === loan.group_id);
        const branch = branchesData?.find(b => b.id === loan.branch_id);
        const officer = profilesData?.find(p => p.id === loan.loan_officer_id);
        const lastRepayment = repaymentsData?.find(r => r.loan_id === loan.id);

        const daysOverdue = Math.floor(
          (new Date().getTime() - new Date(loan.due_date).getTime()) / (1000 * 3600 * 24)
        );
        
        const monthlyPayment = loan.principal_amount / 12; // Assuming 12 month loans
        
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (daysOverdue > 90) riskLevel = 'critical';
        else if (daysOverdue > 60) riskLevel = 'high';
        else if (daysOverdue > 30) riskLevel = 'medium';

        return {
          id: loan.id,
          loan_number: `LN${String(loan.id).slice(-6)}`,
          member_name: member?.full_name || 'Unknown',
          member_code: member?.id_number || 'N/A',
          phone: member?.phone_number || 'N/A',
          group_name: group?.name || 'No Group',
          branch: branch?.name || 'No Branch',
          overdue_amount: monthlyPayment,
          days_overdue: daysOverdue,
          last_payment_date: lastRepayment?.payment_date,
          expected_payment_date: loan.due_date,
          loan_balance: loan.current_balance,
          monthly_payment: monthlyPayment,
          loan_officer: officer?.full_name || 'Unassigned',
          risk_level: riskLevel
        };
      });

      setOverdueItems(overdueData);
    } catch (error) {
      console.error('Error fetching overdue loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const branches = [...new Set(overdueItems.map(item => item.branch))];

  const filteredItems = overdueItems.filter(item => {
    const matchesSearch = item.loan_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.member_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.member_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.group_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = branchFilter === 'all' || item.branch === branchFilter;
    const matchesRisk = riskFilter === 'all' || item.risk_level === riskFilter;
    return matchesSearch && matchesBranch && matchesRisk;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'low': return 'secondary';
      case 'medium': return 'default';
      case 'high': return 'destructive';
      case 'critical': return 'destructive';
      default: return 'secondary';
    }
  };

  const handleExport = (format: 'pdf' | 'csv') => {
    console.log(`Exporting daily overdue report as ${format} for ${reportDate}`);
  };

  const totalOverdueAmount = filteredItems.reduce((sum, item) => sum + item.overdue_amount, 0);

  if (loading) {
    return <Loader size="lg" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Daily Overdue Report</h1>
          <p className="text-muted-foreground">Track and manage overdue loan payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport('pdf')}>
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Report Date and Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Report Date</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Overdue Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{filteredItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Overdue Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {formatCurrency(totalOverdueAmount)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Critical Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {filteredItems.filter(item => item.risk_level === 'critical').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Level Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Risk Level Distribution</CardTitle>
          <CardDescription>Overview of overdue accounts by risk level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['low', 'medium', 'high', 'critical'].map(risk => {
              const count = filteredItems.filter(item => item.risk_level === risk).length;
              const amount = filteredItems
                .filter(item => item.risk_level === risk)
                .reduce((sum, item) => sum + item.overdue_amount, 0);
              
              return (
                <div key={risk} className="text-center p-4 border rounded-lg">
                  <Badge variant={getRiskBadgeVariant(risk) as any} className="mb-2 capitalize">
                    {risk} Risk
                  </Badge>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Overdue Report Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Overdue Loans Detail</CardTitle>
          <CardDescription>Detailed breakdown of all overdue loan accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Overdue Accounts</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by loan number, member name, code, or group..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full lg:w-48">
              <Label htmlFor="risk">Risk Level</Label>
              <Select value={riskFilter} onValueChange={(value: any) => setRiskFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Risks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risks</SelectItem>
                  <SelectItem value="low">Low Risk</SelectItem>
                  <SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                  <SelectItem value="critical">Critical Risk</SelectItem>
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

          {/* Overdue Table */}
          <ScrollableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan & Member</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Overdue Details</TableHead>
                  <TableHead>Payment History</TableHead>
                  <TableHead>Loan Balance</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Loan Officer</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <div className="font-medium">{item.loan_number}</div>
                          <div className="text-sm">{item.member_name}</div>
                          <div className="text-xs text-muted-foreground">{item.member_code}</div>
                          <Badge variant="outline" className="text-xs mt-1">{item.group_name}</Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {item.phone}
                        </div>
                        <div className="text-xs text-muted-foreground">{item.branch}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-destructive">
                          {formatCurrency(item.overdue_amount)}
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                          <span className="font-medium text-destructive">{item.days_overdue} days</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Due: {new Date(item.expected_payment_date).toLocaleDateString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="font-medium">Monthly:</span> {formatCurrency(item.monthly_payment)}
                        </div>
                        {item.last_payment_date ? (
                          <div className="text-xs text-muted-foreground">
                            Last paid: {new Date(item.last_payment_date).toLocaleDateString()}
                          </div>
                        ) : (
                          <div className="text-xs text-destructive">No payments recorded</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(item.loan_balance)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRiskBadgeVariant(item.risk_level) as any} className="capitalize">
                        {item.risk_level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{item.loan_officer}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableContainer>

          {filteredItems.length === 0 && (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No overdue accounts found for the selected criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyOverdue;