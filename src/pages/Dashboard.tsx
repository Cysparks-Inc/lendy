import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, CreditCard, TrendingUp, AlertTriangle, Clock, Banknote, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';

// --- Type Definitions ---
interface DashboardStats {
  total_customers: number;
  total_loans: number;
  total_disbursed: number;
  total_repaid: number;
  outstanding_balance: number;
  active_loans: number;
  pending_loans: number;
  defaulted_loans: number;
  repaid_loans: number;
}
interface RecentLoan {
  id: string;
  principal_amount: number;
  status: 'active' | 'repaid' | 'defaulted' | 'pending';
  member_name: string;
  member_id: string;
}

const Dashboard: React.FC = () => {
  const { user, userRole, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLoans, setRecentLoans] = useState<RecentLoan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      // We don't need to set loading to true here, as it's handled on initial mount.
      // This prevents the screen from flashing on real-time updates.
      try {
        const [statsRes, loansRes] = await Promise.all([
          supabase.rpc('get_dashboard_stats_for_user', { requesting_user_id: user.id }),
          supabase
            .from('loans_with_details')
            .select('id, principal_amount, status, member_name, member_id:customer_id')
            .order('issue_date', { ascending: false })
            .limit(5)
        ]);
        
        if (statsRes.error) throw statsRes.error;
        if (loansRes.error) throw loansRes.error;
        
        if (statsRes.data) setStats(statsRes.data[0]);
        setRecentLoans(loansRes.data || []);
      } catch (error: any) {
        toast.error('Failed to load dashboard data', { description: error.message });
      } finally {
        setLoading(false); // Only set loading to false after the first fetch
      }
    };
    
    fetchData();

    const subscription = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [user]);

  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }
  if (!stats) { return <div className="text-center p-10">Could not load dashboard statistics. Please try refreshing.</div>; }

  // --- ROLE-BASED COMPONENT ROUTING ---
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {profile?.full_name || user?.email}. Here's your personalized overview.</p>
      </div>

      {userRole === 'super_admin' && <SuperAdminDashboard stats={stats} recentLoans={recentLoans} />}
      {userRole === 'branch_manager' && <BranchManagerDashboard stats={stats} recentLoans={recentLoans} />}
      {userRole === 'loan_officer' && <LoanOfficerView stats={stats} recentLoans={recentLoans} />}
    </div>
  );
};

// --- WIDGETS FOR EACH ROLE ---

const SuperAdminDashboard: React.FC<{ stats: DashboardStats; recentLoans: RecentLoan[] }> = ({ stats, recentLoans }) => {
    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
    const collectionRate = stats.total_disbursed > 0 ? (stats.total_repaid / stats.total_disbursed) * 100 : 0;
    const defaultRate = stats.total_loans > 0 ? (stats.defaulted_loans / stats.total_loans) * 100 : 0;
    
    const recentLoanColumns = [
        { header: 'Member', cell: (row: RecentLoan) => <Link to={`/members/${row.member_id}`} className="font-medium text-primary hover:underline">{row.member_name}</Link> },
        { header: 'Amount', cell: (row: RecentLoan) => formatCurrency(row.principal_amount) },
        { header: 'Status', cell: (row: RecentLoan) => <Badge variant={row.status === 'pending' ? 'warning' : 'default'} className="capitalize">{row.status}</Badge> },
        { header: 'Actions', cell: (row: RecentLoan) => <div className="text-right"><Button asChild variant="outline" size="sm"><Link to={`/loans/${row.id}`}>View</Link></Button></div> },
    ];

    return (
        <div className="space-y-6">
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Disbursed" value={formatCurrency(stats.total_disbursed)} icon={DollarSign} />
                <StatCard title="Outstanding Balance" value={formatCurrency(stats.outstanding_balance)} icon={TrendingUp} />
                <StatCard title="Total Customers" value={stats.total_customers} icon={Users} />
                <StatCard title="Total Loans" value={stats.total_loans} icon={CreditCard} subtitle={`${stats.active_loans} active`} />
            </div>
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader><CardTitle>Recent Loans</CardTitle><CardDescription>The last 5 loans created across the system.</CardDescription></CardHeader>
                    <CardContent>
                        <DataTable columns={recentLoanColumns} data={recentLoans} emptyStateMessage="No recent loans found."/>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Portfolio Health</CardTitle><CardDescription>Key performance indicators.</CardDescription></CardHeader>
                    <CardContent className="space-y-6">
                        <HealthMetric label="Collection Rate" value={collectionRate} totalValue={stats.total_disbursed} partialValue={stats.total_repaid} />
                        <HealthMetric label="Default Rate" value={defaultRate} totalValue={stats.total_loans} partialValue={stats.defaulted_loans} variant="destructive" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const BranchManagerDashboard: React.FC<{ stats: DashboardStats; recentLoans: RecentLoan[] }> = ({ stats, recentLoans }) => {
    return <SuperAdminDashboard stats={stats} recentLoans={recentLoans} />
};

const LoanOfficerView: React.FC<{ stats: DashboardStats; recentLoans: RecentLoan[] }> = ({ stats, recentLoans }) => {
    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
    return (
        <div className="space-y-6">
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="My Active Loans" value={stats.active_loans} icon={Banknote} />
                <StatCard title="My Outstanding Balance" value={formatCurrency(stats.outstanding_balance)} icon={TrendingUp} />
                <StatCard title="My Pending Loans" value={stats.pending_loans} icon={Clock} />
                <StatCard title="My Defaulted Loans" value={stats.defaulted_loans} icon={AlertTriangle} />
            </div>
            <Card>
                <CardHeader><CardTitle>My Recent Activity</CardTitle><CardDescription>Your last 5 created loans.</CardDescription></CardHeader>
                <CardContent>
                    {recentLoans.length > 0 ? (
                        <ul className="divide-y">
                            {recentLoans.map(loan => (
                                <li key={loan.id} className="flex items-center justify-between py-3">
                                    <div>
                                        <p className="font-medium">{loan.member_name}</p>
                                        <p className="text-sm text-muted-foreground">{formatCurrency(loan.principal_amount)}</p>
                                    </div>
                                    <Button asChild variant="secondary" size="sm"><Link to={`/loans/${loan.id}`}>View</Link></Button>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-center text-muted-foreground py-10">You have not created any loans recently.</p>}
                </CardContent>
            </Card>
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType; subtitle?: string; }> = ({ title, value, icon: Icon, subtitle }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </CardContent>
  </Card>
);

const HealthMetric: React.FC<{label: string, value: number, totalValue: number, partialValue: number, variant?: "default" | "destructive"}> = ({label, value, totalValue, partialValue, variant}) => {
    // --- THE CRITICAL FIX IS HERE ---
    // We pre-format the strings into simple variables before rendering them.
    // This prevents the React renderer from misinterpreting the formatted currency string.
    const formattedPartial = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(partialValue || 0);
    const formattedTotal = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(totalValue || 0);
    const description = variant === 'destructive' 
        ? `${partialValue} of ${totalValue} loans` 
        : `${formattedPartial} of ${formattedTotal}`;

    return (
        <div>
            <div className="flex justify-between mb-1">
                <p className="text-sm font-medium">{label}</p>
                <span className={`text-sm font-bold ${variant === 'destructive' ? 'text-destructive' : 'text-primary'}`}>{value.toFixed(1)}%</span>
            </div>
            <Progress value={value} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
    );
};

export default Dashboard;