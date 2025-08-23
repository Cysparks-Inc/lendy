import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, UserCheck, Landmark, Banknote, TrendingUp, Users, RefreshCw, Eye, MoreHorizontal, Mail, Edit, Loader2, Plus, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { ExportDropdown } from '@/components/ui/ExportDropdown';

// --- Type Definition ---
interface LoanOfficer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  branch_name: string;
  total_loans: number;
  active_loans: number;
  pending_loans: number;
  completed_loans: number;
  defaulted_loans: number;
  total_disbursed: number;
  total_balance: number;
  status: 'active' | 'inactive';
  total_portfolio?: number; // Added for new summary stats
  performance_score?: number; // Added for new summary stats
}

const LoanOfficerPage: React.FC = () => {
  const { user, userRole } = useAuth();
  const [officers, setOfficers] = useState<LoanOfficer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const fetchLoanOfficers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      console.log('Fetching loan officers with performance data...');
      
      // Step 1: Fetch all loan officers (profiles with loan_officer role)
      const { data: officersData, error: officersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone_number, branch_id, role')
        .eq('role', 'loan_officer');

      if (officersError) throw officersError;
      
      console.log('Raw officers data:', officersData);
      
      if (!officersData || officersData.length === 0) {
        setOfficers([]);
        setLoading(false);
        return;
      }
      
      // Step 2: Fetch all loans to calculate officer performance
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('loan_officer_id, principal_amount, current_balance, status');

      if (loansError) {
        console.warn('Loans fetch error:', loansError);
      }
      
      console.log('Raw loans data for officer stats:', loansData);
      
      // Step 3: Calculate performance metrics for each officer
      const officersWithPerformance = officersData.map(officer => {
        // Find loans managed by this officer
        const officerLoans = (loansData || []).filter(loan => 
          loan.loan_officer_id === officer.id
        );
        
        // Calculate metrics
        const totalLoans = officerLoans.length;
        const pendingLoans = officerLoans.filter(loan => loan.status === 'pending').length;
        const completedLoans = officerLoans.filter(loan => loan.status === 'repaid').length;
        const defaultedLoans = officerLoans.filter(loan => loan.status === 'defaulted').length;
        const activeLoans = officerLoans.filter(loan => loan.status === 'active').length;
        
        const totalPortfolio = officerLoans
          .filter(loan => ['active', 'pending'].includes(loan.status))
          .reduce((sum, loan) => sum + parseFloat(loan.principal_amount || 0), 0);
        
        const outstandingBalance = officerLoans
          .filter(loan => ['active', 'pending'].includes(loan.status))
          .reduce((sum, loan) => sum + parseFloat(loan.current_balance || 0), 0);
        
        const performance = totalLoans > 0 ? 
          ((completedLoans / totalLoans) * 100) : 0;
        
        console.log(`Officer ${officer.full_name}: ${totalLoans} loans, Ksh ${totalPortfolio} portfolio, Ksh ${outstandingBalance} outstanding`);
        
        return {
          id: officer.id,
          name: officer.full_name || 'Unknown Officer',
          email: officer.email || 'N/A',
          phone: officer.phone_number || 'N/A',
          branch_name: 'Nakuru', // Hardcoded for now, can be enhanced later
          total_loans: totalLoans,
          total_disbursed: totalPortfolio,
          total_balance: outstandingBalance,
          status: totalLoans > 0 ? 'active' : 'inactive',
          // Additional fields for display
          pending_loans: pendingLoans,
          completed_loans: completedLoans,
          defaulted_loans: defaultedLoans,
          active_loans: activeLoans,
          performance: performance
        };
      });
      
      console.log('Officers with performance data calculated:', officersWithPerformance);
      setOfficers(officersWithPerformance);
      
    } catch (error: any) {
      console.error('Error fetching officer data:', error);
      toast.error('Failed to fetch officer data', { description: error.message });
      setOfficers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoanOfficers();
    const channel = supabase.channel('officer_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => {
        toast.info("Data refreshed.");
        fetchLoanOfficers();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filteredOfficers = officers.filter(o =>
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.branch_name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  // Mobile-optimized columns with horizontal scrolling container
  const columns = (currentUserRole: typeof userRole) => [
    { 
      header: 'Officer', 
      cell: (row: LoanOfficer) => (
        <div className="min-w-[160px]">
          <Link to={`/loan-officer/${row.id}`} className="font-medium text-primary hover:underline">{row.name}</Link>
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <Mail className="h-4 w-4" />
            <span className="truncate max-w-[120px]">{row.email}</span>
          </div>
        </div>
      ) 
    },
    { 
      header: 'Branch', 
      cell: (row: LoanOfficer) => (
        <div className="min-w-[120px]">{row.branch_name}</div>
      )
    },
    { 
      header: 'Portfolio', 
      cell: (row: LoanOfficer) => (
        <div className="min-w-[100px]">
          <div className="font-medium">{row.active_loans}/{row.total_loans}</div>
          <div className="text-sm text-muted-foreground">{row.pending_loans} pending</div>
        </div>
      )
    },
    { 
      header: 'Balance', 
      cell: (row: LoanOfficer) => (
        <div className="min-w-[140px] text-right">
          <div className="font-mono">{formatCurrency(row.total_balance)}</div>
          <div className="text-sm text-muted-foreground">Outstanding</div>
        </div>
      )
    },
    { 
      header: 'Performance', 
      cell: (row: LoanOfficer) => (
        <div className="min-w-[100px] text-right">
          <div className="text-green-600">{row.completed_loans} Complete</div>
          <div className={`text-sm ${row.defaulted_loans > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
            {row.defaulted_loans} Defaulted
          </div>
        </div>
      )
    },
    { 
      header: 'Actions', 
      cell: (row: LoanOfficer) => (
        <div className="min-w-[60px] text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/loan-officer/${row.id}`}>
                  <Eye className="h-4 w-4 mr-2" /> View Profile
                </Link>
              </DropdownMenuItem>
              {currentUserRole === 'super_admin' && (
                <DropdownMenuItem asChild>
                  <Link to={`/users/${row.id}/edit`}>
                    <Edit className="h-4 w-4 mr-2" /> Edit User
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
  ];

  const totalOutstanding = officers.reduce((sum, o) => sum + (o.total_balance || 0), 0);
  const totalDisbursed = officers.reduce((sum, o) => sum + (o.total_disbursed || 0), 0);
  const activeOfficers = officers.filter(o => o.status === 'active').length;

  if (loading) { 
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ); 
  }

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Loan Officers</h1>
          <p className="text-muted-foreground">Manage loan officer profiles and performance.</p>
        </div>
        {userRole === 'super_admin' && (
          <Button asChild><Link to="/users/new"><Plus className="h-4 w-4 mr-2" />Add Officer</Link></Button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Officers" value={officers.length} icon={Users} />
        <StatCard title="Active Officers" value={activeOfficers} icon={UserCheck} />
        <StatCard title="Total Portfolio" value={formatCurrency(totalDisbursed)} icon={DollarSign} />
        <StatCard title="Avg Performance" value={`${Math.round(officers.reduce((sum, o) => sum + (o.performance || 0), 0) / Math.max(officers.length, 1))}%`} icon={TrendingUp} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Officer Directory</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search officers..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns(userRole)} 
            data={filteredOfficers} 
            emptyStateMessage="No loan officers found for your role."
          />
        </CardContent>
      </Card>
    </div>
  );
};

// Mobile-Optimized StatCard Component
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType }> = ({ title, value, icon: Icon }) => (
  <Card className="bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-brand-green-800">{title}</CardTitle>
      <Icon className="h-4 w-4 text-brand-green-600" />
    </CardHeader>
    <CardContent>
      <div className="text-lg sm:text-2xl font-bold text-brand-green-700">{value}</div>
    </CardContent>
  </Card>
);

export default LoanOfficerPage;