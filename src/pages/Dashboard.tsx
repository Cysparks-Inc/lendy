import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
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
  RefreshCw,
  AlertTriangle
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
  const { addNotification } = useNotifications();
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
      
      
      // Step 1: Fetch all loans and members
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select('*');

      if (loansError) {
        throw loansError;
      }

      const { data: members, error: membersError } = await supabase
        .from('members')
        .select('*');

      if (membersError) {
        throw membersError;
      }
      
      // Step 2: Apply role-based filtering to the data
      let filteredLoans = loans || [];
      let filteredMembers = members || [];
      
      if (userRole === 'branch_admin' && profile?.branch_id) {
        filteredLoans = filteredLoans.filter(loan => loan.branch_id === profile.branch_id);
        filteredMembers = filteredMembers.filter(member => member.branch_id === profile.branch_id);
      } else if (userRole === 'loan_officer') {
        // Loan officers can only see loans and members assigned to them
        // Filter by assigned_officer_id for members
        filteredMembers = filteredMembers.filter(member => {
          const memberObj = member as any;
          return memberObj.assigned_officer_id === user?.id;
        });
        
        // Get member IDs that are assigned to this loan officer
        const assignedMemberIds = new Set(filteredMembers.map(m => m.id));
        
        // Filter loans by loan_officer_id OR by assigned member IDs
        filteredLoans = filteredLoans.filter(loan => {
          const loanMemberId = loan.member_id || loan.customer_id;
          return (
            loan.loan_officer_id === user?.id || 
            loan.created_by === user?.id ||
            (loanMemberId && assignedMemberIds.has(loanMemberId))
          );
        });
      } else if (userRole !== 'super_admin' && profile?.branch_id) {
        // Teller/Auditor
        filteredLoans = filteredLoans.filter(loan => loan.branch_id === profile.branch_id);
        filteredMembers = filteredMembers.filter(member => member.branch_id === profile.branch_id);
      }
      
      // Step 3: Get unified overdue count
      const { data: overdueData, error: overdueError } = await supabase
        .rpc('get_unified_overdue_loans_report', { requesting_user_id: user?.id });

      if (overdueError) {
        // Silently handle overdue data error
      }

      // Include all loans (pending and approved) for dashboard display
      const approvedLoans = (filteredLoans || []);

      const stats = {
        total_members: filteredMembers.length,
        total_loans: approvedLoans.length,
        active_loans: approvedLoans.filter(l => ['active', 'pending'].includes((l as any).status)).length,
        total_disbursed: approvedLoans
          .filter((loan: any) => ['active', 'pending', 'repaid', 'defaulted'].includes((loan as any).status))
          .reduce((sum: number, loan: any) => sum + parseFloat((loan as any).principal_amount || 0), 0),
        outstanding_balance: approvedLoans
          .filter((loan: any) => ['active', 'pending', 'defaulted'].includes((loan as any).status))
          .reduce((sum: number, loan: any) => sum + parseFloat((loan as any).current_balance || 0), 0),
        overdue_loans: overdueData?.length || 0 // Use installment-based overdue count
      };
      
      setStats(stats);
      
      // Step 5: Get recent loans and fetch related names
      const recentLoans = approvedLoans
        .sort((a: any, b: any) => new Date((b as any).created_at).getTime() - new Date((a as any).created_at).getTime())
        .slice(0, 5);
      
      if (recentLoans.length > 0) {
        // Collect unique IDs for batch fetching
        const memberIds = [...new Set(recentLoans.map(loan => (loan as any).member_id || (loan as any).customer_id).filter(Boolean))];
        const officerIds = [...new Set(recentLoans.map(loan => (loan as any).loan_officer_id).filter(Boolean))];
        
        // Batch fetch names
        const [membersRes, officersRes] = await Promise.all([
          memberIds.length > 0 ? supabase.from('members').select('id, first_name, last_name').in('id', memberIds) : { data: [], error: null },
          officerIds.length > 0 ? supabase.from('profiles').select('id, full_name').in('id', officerIds) : { data: [], error: null }
        ]);
        
        // Create lookup maps
        const membersMap = new Map((membersRes.data || []).map(m => [m.id, `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Unknown Member']));
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
      } else {
        setRecentLoans([]);
      }
      
    } catch (error) {
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
          <div className="flex items-center gap-2">
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
      </div>

      {/* Stats Cards - Now Clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3 sm:gap-4">
        <StatCard
          icon={Banknote}
          title={userRole === 'loan_officer' ? 'Disbursed' : 'Disbursed'}
          value={formatCurrency(stats?.total_disbursed || 0)}
          description={userRole === 'loan_officer' ? 'To members' : 'Total disbursed'}
          onClick={() => handleStatCardClick('disbursed')}
        />
        <StatCard
          icon={DollarSign}
          title={userRole === 'loan_officer' ? 'Outstanding' : 'Outstanding'}
          value={formatCurrency(stats?.outstanding_balance || 0)}
          description={userRole === 'loan_officer' ? 'From members' : 'Total outstanding'}
          onClick={() => handleStatCardClick('outstanding')}
        />
        <StatCard
          icon={Users}
          title={userRole === 'loan_officer' ? 'Members' : 'Members'}
          value={stats?.total_members || 0}
          description={userRole === 'loan_officer' ? 'Assigned' : 'Active'}
          onClick={() => handleStatCardClick('members')}
        />
        <StatCard
          icon={TrendingUp}
          title={userRole === 'loan_officer' ? 'Loans' : 'Loans'}
          value={stats?.total_loans || 0}
          description={userRole === 'loan_officer' ? `${stats?.active_loans || 0} active` : `${stats?.active_loans || 0} active`}
          onClick={() => handleStatCardClick('loans')}
        />
        {stats?.overdue_loans > 0 && (
          <StatCard
            icon={AlertTriangle}
            title="Overdue Loans"
            value={stats.overdue_loans}
            description="Requires immediate attention"
            onClick={() => navigate('/daily-overdue')}
          />
        )}
      </div>

      {/* Loans Overdue Alert Card */}
      {stats?.overdue_loans > 0 && (
        <Card className="border-red-200 bg-red-50 hover:bg-red-100 transition-colors">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-red-800">Loans Overdue Alert</CardTitle>
                  <CardDescription className="text-red-600">
                    {stats.overdue_loans} loan{stats.overdue_loans > 1 ? 's' : ''} require{stats.overdue_loans > 1 ? '' : 's'} immediate attention
                  </CardDescription>
                </div>
              </div>
              <Button asChild variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
                <Link to="/daily-overdue">
                  View Overdue
                  <AlertTriangle className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Recent Activity and System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Recent System Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent System Activity</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link to="/loans">View All</Link>
              </Button>
            </div>
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

      {/* Approvals Snapshot */}
      <div className="grid grid-cols-1 gap-4 md:gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Loan Approvals</CardTitle>
              {['super_admin','admin','branch_admin'].includes(userRole || '') && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/loans/approvals">Go to Approvals</Link>
                </Button>
              )}
            </div>
            <CardDescription className="text-sm">Quick view of submissions and statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <ApprovalSnapshot userRole={userRole || ''} userId={user?.id || ''} />
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
    className={`bg-gradient-to-br from-brand-blue-50 to-brand-blue-100 border-brand-blue-200 hover:border-brand-blue-300 transition-all duration-200 hover:shadow-md p-2 sm:p-3 overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-0 pt-0">
      <CardTitle className="text-xs font-medium text-brand-blue-800 truncate pr-2">{title}</CardTitle>
      <Icon className="h-3 w-3 text-brand-blue-600 flex-shrink-0" />
    </CardHeader>
    <CardContent className="px-0 pb-0">
      <div className="text-base sm:text-xl font-bold text-brand-blue-700 truncate">{value}</div>
      <p className="text-xs text-muted-foreground truncate hidden sm:block mt-1">{description}</p>
    </CardContent>
  </Card>
);

export default Dashboard;

const ApprovalSnapshot: React.FC<{ userRole: string; userId: string }> = ({ userRole, userId }) => {
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('loans')
          .select('id, principal_amount, approval_status, created_at, created_by, loan_officer_id, member_id')
          .order('created_at', { ascending: false })
          .limit(6);
        if (error) throw error;

        const filtered = (data || []).filter(l =>
          ['super_admin','admin','branch_admin'].includes(userRole) ? true : (l.created_by === userId || l.loan_officer_id === userId)
        );

        // Batch fetch member and officer names
        const memberIds = [...new Set(filtered.map(l => (l as any).member_id).filter(Boolean))];
        const officerIds = [...new Set(filtered.map(l => l.loan_officer_id).filter(Boolean))];
        const [membersRes, officersRes] = await Promise.all([
          memberIds.length > 0 ? supabase.from('members').select('id, first_name, last_name').in('id', memberIds) : { data: [], error: null },
          officerIds.length > 0 ? supabase.from('profiles').select('id, full_name').in('id', officerIds) : { data: [], error: null }
        ]);
        
        const membersMap = new Map((membersRes.data || []).map((m: any) => [m.id, `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Unknown Member']));
        const officersMap = new Map((officersRes.data || []).map((o: any) => [o.id, o.full_name]));

        const enriched = filtered.map(l => ({
          ...l,
          member_name: (l as any).member_id ? (membersMap.get((l as any).member_id) || 'Unknown Member') : 'Unknown Member',
          officer_name: l.loan_officer_id ? (officersMap.get(l.loan_officer_id) || 'Unassigned Officer') : 'Unassigned Officer'
        }));

        setRows(enriched);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userRole, userId]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (rows.length === 0) return <div className="text-sm text-muted-foreground">No recent submissions</div>;

  return (
    <div className="space-y-2">
      {rows.map(row => (
        <div key={row.id} className="flex items-center justify-between border rounded-md p-2">
          <div className="flex items-center gap-3">
            <div className="font-mono text-xs">{row.id.slice(0,8)}...</div>
            <div className="text-sm">KES {Number(row.principal_amount || 0).toLocaleString()}</div>
            <Badge className="capitalize" variant={row.approval_status === 'approved' ? 'secondary' : row.approval_status === 'rejected' ? 'destructive' : 'outline'}>
              {row.approval_status || 'pending'}
            </Badge>
            <div className="text-xs text-muted-foreground">{row.member_name}</div>
            <div className="text-xs text-muted-foreground hidden sm:block">• Officer: {row.officer_name}</div>
            <div className="text-xs text-muted-foreground hidden md:block">• {new Date(row.created_at).toLocaleString()}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to={`/loans/${row.id}`}>Open</Link>
            </Button>
            {['super_admin','admin','branch_admin'].includes(userRole) && (
              <Button asChild size="sm">
                <Link to="/loans/approvals">Manage</Link>
              </Button>
            )}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link to={['super_admin','admin','branch_admin'].includes(userRole) ? '/loans/approvals' : '/loans'}>View All</Link>
        </Button>
      </div>
    </div>
  );
};