import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, CreditCard, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
interface DashboardStats {
  totalCustomers: number;
  totalLoans: number;
  totalLoanAmount: number;
  totalRepaid: number;
  outstandingBalance: number;
  activeLoans: number;
  defaultedLoans: number;
  repaidLoans: number;
}
const Dashboard = () => {
  const {
    user
  } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    totalLoans: 0,
    totalLoanAmount: 0,
    totalRepaid: 0,
    outstandingBalance: 0,
    activeLoans: 0,
    defaultedLoans: 0,
    repaidLoans: 0
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        // Fetch customer count
        const {
          count: customerCount
        } = await supabase.from('customers').select('*', {
          count: 'exact',
          head: true
        });

        // Fetch loan statistics
        const {
          data: loans
        } = await supabase.from('loans').select('principal_amount, current_balance, status');

        // Fetch total repayments
        const {
          data: repayments
        } = await supabase.from('repayments').select('amount');
        const totalRepaid = repayments?.reduce((sum, payment) => sum + parseFloat(String(payment.amount || '0')), 0) || 0;
        const totalLoanAmount = loans?.reduce((sum, loan) => sum + parseFloat(String(loan.principal_amount || '0')), 0) || 0;
        const outstandingBalance = loans?.reduce((sum, loan) => sum + parseFloat(String(loan.current_balance || '0')), 0) || 0;
        const activeLoans = loans?.filter(loan => loan.status === 'active').length || 0;
        const defaultedLoans = loans?.filter(loan => loan.status === 'defaulted').length || 0;
        const repaidLoans = loans?.filter(loan => loan.status === 'repaid').length || 0;
        setStats({
          totalCustomers: customerCount || 0,
          totalLoans: loans?.length || 0,
          totalLoanAmount,
          totalRepaid,
          outstandingBalance,
          activeLoans,
          defaultedLoans,
          repaidLoans
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardStats();
  }, []);
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };
  if (loading) {
    return <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back to LendWise</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardHeader>
            </Card>)}
        </div>
      </div>;
  }
  return <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.email}. Here's your lending overview.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Active customer base</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.totalLoans}</div>
            <p className="text-xs text-muted-foreground">Loans processed</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Disbursed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(stats.totalLoanAmount)}</div>
            <p className="text-xs text-muted-foreground">Principal amount</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Repaid</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(stats.totalRepaid)}</div>
            <p className="text-xs text-muted-foreground">Collected payments</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{formatCurrency(stats.outstandingBalance)}</div>
            <p className="text-xs text-muted-foreground">Due amount</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.activeLoans}</div>
            <Badge variant="secondary" className="bg-success-light  text-black">Active</Badge>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repaid Loans</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.repaidLoans}</div>
            <Badge variant="secondary" className="bg-success-light  text-black">Completed</Badge>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Defaulted Loans</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.defaultedLoans}</div>
            <Badge variant="secondary" className="bg-destructive-light text-black">Defaulted</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Collection Rate</span>
                <span className="font-medium text-success">
                  {stats.totalLoanAmount > 0 ? (stats.totalRepaid / stats.totalLoanAmount * 100).toFixed(1) : '0'}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Default Rate</span>
                <span className="font-medium text-destructive">
                  {stats.totalLoans > 0 ? (stats.defaultedLoans / stats.totalLoans * 100).toFixed(1) : '0'}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg Loan Size</span>
                <span className="font-medium">
                  {stats.totalLoans > 0 ? formatCurrency(stats.totalLoanAmount / stats.totalLoans) : formatCurrency(0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest system activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                System operational. All services running normally.
              </p>
              <p className="text-sm text-muted-foreground">
                Interest calculations updated daily at midnight.
              </p>
              <p className="text-sm text-muted-foreground">
                Audit logs maintained for compliance.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>;
};
export default Dashboard;