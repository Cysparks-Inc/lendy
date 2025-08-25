import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Banknote, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Eye,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { InlineLoader, QuickLoader } from '@/components/ui/loader';

// Helper function for currency formatting
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

interface DashboardStats {
  total_members: number;
  total_loans: number;
  active_loans: number;
  total_disbursed: number;
  outstanding_balance: number;
  overdue_loans: number;
}

interface RecentLoan {
  id: string;
  principal_amount: number;
  status: string;
  due_date: string;
  member_name: string;
  member_id: string;
  loan_officer_name: string;
}

const Dashboard: React.FC = () => {
  const { user, userRole, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLoans, setRecentLoans] = useState<RecentLoan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Debug logging
      console.log('Dashboard Debug:', {
        userRole,
        userId: user?.id,
        profileBranchId: profile?.branch_id,
        profile: profile
      });
      
      // Step 1: Fetch all loans and members
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select('*');

      if (loansError) {
        console.error('Loans query error:', loansError);
        throw loansError;
      }

      const { data: members, error: membersError } = await supabase
        .from('members')
        .select('*');

      if (membersError) {
        console.error('Members query error:', membersError);
        throw membersError;
      }
      
      console.log('Raw loans data:', loans);
      console.log('Raw members data:', members);
      
      // Step 2: Apply role-based filtering to the data
      let filteredLoans = loans || [];
      let filteredMembers = members || [];
      
      if (userRole === 'branch_manager' && profile?.branch_id) {
        filteredLoans = filteredLoans.filter(loan => loan.branch_id === profile.branch_id);
        filteredMembers = filteredMembers.filter(member => member.branch_id === profile.branch_id);
      } else if (userRole === 'loan_officer') {
        // Loan officers can only see loans and members assigned to them
        filteredLoans = filteredLoans.filter(loan => 
          loan.loan_officer_id === user?.id || loan.created_by === user?.id
        );
        filteredMembers = filteredMembers.filter(member => 
          (member as any).assigned_officer_id === user?.id
        );
        console.log('Loan officer filtering applied:', {
          userId: user?.id,
          filteredLoans: filteredLoans.length,
          filteredMembers: filteredMembers.length
        });
      } else if (userRole !== 'super_admin' && profile?.branch_id) {
        // Teller/Auditor
        filteredLoans = filteredLoans.filter(loan => loan.branch_id === profile.branch_id);
        filteredMembers = filteredMembers.filter(member => member.branch_id === profile.branch_id);
      }
      
      // Step 3: Calculate stats
      const stats = {
        total_members: filteredMembers.length,
        total_loans: filteredLoans.length,
        active_loans: filteredLoans.filter(l => ['active', 'pending'].includes((l as any).status)).length,
        total_disbursed: filteredLoans
          .filter((loan: any) => ['active', 'pending'].includes((loan as any).status))
          .reduce((sum: number, loan: any) => sum + parseFloat((loan as any).principal_amount || 0), 0),
        outstanding_balance: filteredLoans
          .filter((loan: any) => ['active', 'pending'].includes((loan as any).status))
          .reduce((sum: number, loan: any) => sum + parseFloat((loan as any).current_balance || 0), 0),
        overdue_loans: filteredLoans.filter(l => 
          ['active', 'pending'].includes((l as any).status) && 
          (l as any).due_date && new Date((l as any).due_date) < new Date()
        ).length
      };
      
      setStats(stats);
      console.log('Dashboard stats calculated:', stats);
      
      // Step 4: Get recent loans and fetch related names
      const recentLoans = filteredLoans
        .sort((a: any, b: any) => new Date((b as any).created_at).getTime() - new Date((a as any).created_at).getTime())
        .slice(0, 5);
      
      if (recentLoans.length > 0) {
        // Collect unique IDs for batch fetching
        const memberIds = [...new Set(recentLoans.map(loan => (loan as any).member_id || (loan as any).customer_id).filter(Boolean))];
        const officerIds = [...new Set(recentLoans.map(loan => (loan as any).loan_officer_id).filter(Boolean))];
        
        // Batch fetch names
        const [membersRes, officersRes] = await Promise.all([
          memberIds.length > 0 ? supabase.from('members').select('id, full_name').in('id', memberIds) : { data: [], error: null },
          officerIds.length > 0 ? supabase.from('profiles').select('id, full_name').in('id', officerIds) : { data: [], error: null }
        ]);
        
        // Create lookup maps
        const membersMap = new Map((membersRes.data || []).map(m => [m.id, m.full_name]));
        const officersMap = new Map((officersRes.data || []).map(o => [o.id, o.full_name]));
        
        // Transform with real names
        const loansWithDetails = recentLoans.map((loan: any) => {
          const memberId = loan.member_id || loan.customer_id;
          const memberName = memberId ? (membersMap.get(memberId) || `Unknown Member (${memberId.slice(0, 8)})`) : 'Unassigned Member';
          const officerName = loan.loan_officer_id ? (officersMap.get(loan.loan_officer_id) || `Unknown Officer (${loan.loan_officer_id.slice(0, 8)})`) : 'Unassigned Officer';
          
          return {
            id: loan.id,
            principal_amount: loan.principal_amount || 0,
            status: loan.status,
            due_date: loan.due_date,
            member_name: memberName,
            member_id: memberId,
            loan_officer_name: officerName
          };
        });
        
        setRecentLoans(loansWithDetails);
        console.log('Recent loans with real names:', loansWithDetails);
      } else {
        setRecentLoans([]);
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set default stats on error
      setStats({
        total_members: 0,
        total_loans: 0,
        active_loans: 0,
        total_disbursed: 0,
        outstanding_balance: 0,
        overdue_loans: 0
      });
      setRecentLoans([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'pending': return 'secondary';
      case 'repaid': return 'default';
      case 'defaulted': return 'destructive';
      default: return 'secondary';
    }
  };

  // Navigation handlers for stat cards
  const handleStatCardClick = (destination: string) => {
    switch (destination) {
      case 'members':
        navigate('/members');
        break;
      case 'loans':
        navigate('/loans');
        break;
      case 'disbursed':
        navigate('/loans');
        break;
      case 'outstanding':
        navigate('/loans');
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <InlineLoader />
      </div>
    );
  }

  const collectionRate = stats?.total_disbursed ? (stats.total_disbursed - stats.outstanding_balance) / stats.total_disbursed * 100 : 0;
  const defaultRate = stats?.total_loans ? (stats.overdue_loans / stats.total_loans) * 100 : 0;

  return (
    <div className="space-y-4 md:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {userRole === 'loan_officer' ? 'My Portfolio Dashboard' : 'Dashboard'}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {userRole === 'loan_officer' 
                ? `Welcome back, Loan Officer! Here's an overview of your assigned members and loans.`
                : `Welcome back, ${userRole === 'super_admin' ? 'Super Admin' : userRole === 'branch_admin' ? 'Branch Admin' : 'User'} ${user?.email}`
              }
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            {loading ? <QuickLoader /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards - Now Clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 sm:gap-6">
        <StatCard
          icon={Banknote}
          title={userRole === 'loan_officer' ? 'My Portfolio Disbursed' : 'System Disbursed'}
          value={formatCurrency(stats?.total_disbursed || 0)}
          description={userRole === 'loan_officer' ? 'Total amount disbursed to your members' : 'Total amount disbursed'}
          onClick={() => handleStatCardClick('disbursed')}
        />
        <StatCard
          icon={DollarSign}
          title={userRole === 'loan_officer' ? 'My Portfolio Outstanding' : 'Outstanding Balance'}
          value={formatCurrency(stats?.outstanding_balance || 0)}
          description={userRole === 'loan_officer' ? 'Total outstanding from your members' : 'Total outstanding amount'}
          onClick={() => handleStatCardClick('outstanding')}
        />
        <StatCard
          icon={Users}
          title={userRole === 'loan_officer' ? 'My Assigned Members' : 'Total Members'}
          value={stats?.total_members || 0}
          description={userRole === 'loan_officer' ? 'Members assigned to you' : 'Active members'}
          onClick={() => handleStatCardClick('members')}
        />
        <StatCard
          icon={TrendingUp}
          title={userRole === 'loan_officer' ? 'My Portfolio Loans' : 'Total Loans'}
          value={stats?.total_loans || 0}
          description={userRole === 'loan_officer' ? `${stats?.active_loans || 0} active in your portfolio` : `${stats?.active_loans || 0} active`}
          onClick={() => handleStatCardClick('loans')}
        />
      </div>

      {/* Recent Activity and System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Recent System Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent System Activity</CardTitle>
            <CardDescription className="text-sm">
              {userRole === 'loan_officer' 
                ? 'Latest loans from your assigned members'
                : 'Latest loans across all branches'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { header: 'Member', cell: (row) => (
                  <Link to={`/members/${row.member_id}`} className="font-medium text-primary hover:underline">
                    {row.member_name}
                  </Link>
                ) },
                { header: 'Amount', cell: (row) => formatCurrency(row.principal_amount) },
                { header: 'Status', cell: (row) => (
                  <Badge variant={getStatusVariant(row.status)} className="capitalize">
                    {row.status}
                  </Badge>
                ) },
                { header: 'Loan Officer', cell: (row) => (
                  <span className="text-sm text-muted-foreground">{row.loan_officer_name}</span>
                ) },
                { header: 'Actions', cell: (row) => (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/loans/${row.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Link>
                  </Button>
                ) }
              ]}
              data={recentLoans}
              emptyStateMessage="No recent loans found."
            />
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Health</CardTitle>
            <CardDescription className="text-sm">Overall portfolio performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6">
            {/* Collection Rate */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Collection Rate</span>
                <span className="font-semibold text-green-600">{collectionRate.toFixed(1)}%</span>
              </div>
              <Progress value={collectionRate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {formatCurrency((stats?.total_disbursed || 0) - (stats?.outstanding_balance || 0))} of {formatCurrency(stats?.total_disbursed || 0)}
              </p>
            </div>

            {/* Default Rate */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Default Rate</span>
                <span className="font-semibold text-red-600">{defaultRate.toFixed(1)}%</span>
              </div>
              <Progress value={defaultRate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {stats?.overdue_loans || 0} of {stats?.total_loans || 0} loans
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ 
  title: string; 
  value: string | number; 
  description: string; 
  icon: React.ElementType;
  onClick?: () => void;
}> = ({ 
  title, 
  value, 
  description, 
  icon: Icon,
  onClick
}) => (
  <Card 
    className={`bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md p-3 sm:p-4 ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
      <CardTitle className="text-xs md:text-sm font-medium text-brand-green-800">{title}</CardTitle>
      <Icon className="h-4 w-4 text-brand-green-600" />
    </CardHeader>
    <CardContent className="px-0 pb-0">
      <div className="text-lg md:text-2xl font-bold text-brand-green-700">{value}</div>
      <p className="text-xs text-muted-foreground hidden sm:block">{description}</p>
    </CardContent>
  </Card>
);

export default Dashboard;