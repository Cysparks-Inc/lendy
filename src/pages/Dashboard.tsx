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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-heading-1 text-foreground">Dashboard</h1>
          <p className="text-body text-muted-foreground mt-1">
            Welcome back! Here's an overview of your financial portfolio.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDashboardData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-body font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-heading-2">{stats?.total_members || 0}</div>
            <p className="text-caption text-muted-foreground">
              Active members in your portfolio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-body font-medium">Total Loans</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-heading-2">{stats?.total_loans || 0}</div>
            <p className="text-caption text-muted-foreground">
              Active loans managed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-body font-medium">Active Loans</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-heading-2">{stats?.active_loans || 0}</div>
            <p className="text-caption text-muted-foreground">
              Currently active loans
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-body font-medium">Total Portfolio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-heading-2">{formatCurrency(stats?.total_disbursed || 0)}</div>
            <p className="text-caption text-muted-foreground">
              Total amount disbursed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Loans */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-2">Recent Loans</CardTitle>
          <CardDescription className="text-body text-muted-foreground">
            Latest loan activities in your portfolio
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentLoans.length > 0 ? (
            <div className="space-y-4">
              {recentLoans.map((loan) => (
                <div key={loan.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Banknote className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-body font-medium">{loan.member_name}</p>
                      <p className="text-caption text-muted-foreground">
                        {loan.member_id?.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-body font-medium">{formatCurrency(loan.principal_amount)}</p>
                    <Badge variant={getStatusVariant(loan.status)} className="text-caption">
                      {loan.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Banknote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-body text-muted-foreground">No recent loans found</p>
            </div>
          )}
        </CardContent>
      </Card>
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