import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, CreditCard, TrendingUp, AlertTriangle, CheckCircle, Activity, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from 'recharts';

interface DashboardStats {
  total_customers: number;
  total_loans: number;
  total_disbursed: number;
  total_repaid: number;
  outstanding_balance: number;
  active_loans: number;
  defaulted_loans: number;
  repaid_loans: number;
}

interface RecentLoan {
  id: string;
  principal_amount: number;
  status: string;
  members: {
    full_name: string;
  };
}

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLoans, setRecentLoans] = useState<RecentLoan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats from the new database function
      const { data: statsData, error: statsError } = await supabase.rpc('get_dashboard_stats');
      if (statsError) throw statsError;
      if (statsData) setStats(statsData[0]);

      // Fetch recent loans
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('id, principal_amount, status, members(full_name)')
        .order('created_at', { ascending: false })
        .limit(5);
      if (loansError) throw loansError;
      setRecentLoans(loansData || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Set up real-time subscriptions
    const subscription = supabase.channel('public:dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repayments' }, fetchDashboardData)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  const collectionRate = stats && stats.total_disbursed > 0 ? (stats.total_repaid / stats.total_disbursed) * 100 : 0;
  const defaultRate = stats && stats.total_loans > 0 ? (stats.defaulted_loans / stats.total_loans) * 100 : 0;

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, here's a real-time overview of your portfolio.</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Disbursed" value={formatCurrency(stats?.total_disbursed)} icon={DollarSign} subtitle="Principal amount given out" />
        <StatCard title="Outstanding Balance" value={formatCurrency(stats?.outstanding_balance)} icon={TrendingUp} subtitle="Currently active loans" />
        <StatCard title="Total Customers" value={stats?.total_customers} icon={Users} subtitle="All registered members" />
        <StatCard title="Total Loans" value={stats?.total_loans} icon={CreditCard} subtitle={`${stats?.active_loans} active`} />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent Loans</CardTitle><CardDescription>The last 5 loans created in the system.</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {recentLoans.map(loan => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{loan.members?.full_name || 'N/A'}</TableCell>
                    <TableCell>{formatCurrency(loan.principal_amount)}</TableCell>
                    <TableCell><Badge variant={loan.status === 'defaulted' ? 'destructive' : 'outline'} className="capitalize">{loan.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Portfolio Health</CardTitle><CardDescription>Key performance indicators.</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between mb-1">
                <Label>Collection Rate</Label>
                <span className="text-sm font-bold text-green-600">{collectionRate.toFixed(1)}%</span>
              </div>
              <Progress value={collectionRate} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(stats?.total_repaid)} collected of {formatCurrency(stats?.total_disbursed)}</p>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <Label>Default Rate</Label>
                <span className="text-sm font-bold text-red-600">{defaultRate.toFixed(1)}%</span>
              </div>
              <Progress value={defaultRate} variant="destructive" className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{stats?.defaulted_loans} of {stats?.total_loans} loans have defaulted</p>
            </div>
            <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{stats?.repaid_loans} Repaid</span>
                </div>
                 <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">{stats?.active_loans} Active</span>
                </div>
                 <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm">{stats?.defaulted_loans} Defaulted</span>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, subtitle }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </CardContent>
  </Card>
);

export default Dashboard;
